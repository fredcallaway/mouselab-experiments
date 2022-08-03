
async function initializeExperiment() {
  LOG_DEBUG('initializeExperiment');

  ///////////
  // Setup //
  ///////////

  // var costs = [0, 8]
  var trial_sets = [1,2,3,4,5]
  var costs = [0,1,2,4,8]
  var sigmas = [75, 150]
  var [sigma, tset, cost] = cartesian(sigmas, trial_sets, costs)[CONDITION]

  var searchParams = new URLSearchParams(location.search)
  var set_cond = searchParams.get('condition')
  if (LOCAL) {
    CONDITION = _.random(49)
  }
  if (set_cond != undefined) {
    console.log('setting condition to ' + set_cond)
    CONDITION = parseInt(set_cond)
    console.log(CONDITION)
  }

  var TRIALS = await $.getJSON(`static/json/trials_${tset}.json`);

  const PARAMS = {
    alpha: TRIALS.params.alpha,
    mu: 0,
    sigma: sigma,
    cost: cost,
    bonus_rate: 0.002,
    n_trial: 20,
    n_comprehension: 3,
    n_dominating: 3
  }
  console.log(PARAMS)


  for (let k in TRIALS) {
    if (k == "params") continue;
    // TRIALS[k] = _.shuffle(TRIALS[k])
    // let trials = TRIALS[k]
    let trials = _.shuffle(TRIALS[k])
    for (let t of trials) {
      let M = t.payoff_matrix
      // console.log(M)
      for (let i in M) {
        for (let j in M[i]) {
          M[i][j] = Math.round(PARAMS.mu + PARAMS.sigma * M[i][j])
        }
      }
    }
    TRIALS[k] = trials
  }


  var PPD = 1 / PARAMS.bonus_rate

  psiturk.recordUnstructuredData('params', PARAMS);

  function make_points(x) {
    var unit = x == 1 ? 'Point' : 'Points'
    return x+' '+unit
  }

  var TOTAL_POINTS = 0

  function count_points(trial_data) {
    TOTAL_POINTS += trial_data.net_payoff
  }

  var EXTRA_BONUS = 0

  function compute_bonus() {
    return Math.max(0, TOTAL_POINTS * PARAMS.bonus_rate) + EXTRA_BONUS
  }

  var COLORS = ['Blue','Green','Yellow','Red']
  TYPE = {
    mouselab: {
      bonus_rate: PARAMS.bonus_rate,
      type: 'mouselab',
      cost: PARAMS.cost,
      click_colors: ['#979AB6'],
      show_legend: false,
      option_title: '100 Balls',
      option_labels: COLORS,
    },
    text: {
      type: "html-button-response",
      choices: ["Continue"],
      timing_post_trial: 2000
    }
  }


  //////////////////
  // Instructions //
  //////////////////


  var instruct0 = {
    type: "html-button-response",
    choices: ["Continue"],
    stimulus: markdown(`
      # Welcome

      Thanks for accepting our HIT. In this HIT, you will play a gambling game.

      If you play well, you can earn a large bonus:
      <b>One dollar for every ${PPD} points!</b>

      <div class='alert alert-warning'>
        <b>WARNING:</b>&nbsp;&nbsp;
        We will be testing you to make sure that you understand the game. <b>If you do not pass
        this test, you will not be able to complete the experiment and will not earn any bonus.</b>
        You will not have a chance to try again, so be careful the first time!
      </div>

    `),
    timing_post_trial: 1000
  };


  var instruct1 = _.range(3).map(i=> {
    var trial = TRIALS.standard.pop()
    var text = [
      `
        On each round, you will play a game that is defined by a table like
        the one you see below. Each column of the table (except the first)
        corresponds to a gamble you can make. You can choose a gamble by
        clicking on the top row. Try selecting Option 1, then click
        Continue.<br>(You might have to scroll down)

        These practice rounds don't count towards your bonus.
      ` , `
        After you choose one of the columns, we will randomly select one of
        the rows. You then win the amount indicated in the corresponding cell.
        Select Option 3 this time.
      ` , `
        The first column tells you how likely it is that each row will be
        chosen. To choose a row, we fill a big jar with 100 balls of different
        colors and randomly pick a ball from the jar. In the game below, there
        are many more red balls than any other color, so the last row is most
        likely to be chosen.<br>Please select Option 6.
      `
    ][i]
    var x = {
      trial_id: `instruct1_${i}`,
      ...TYPE.mouselab,
      ...trial,
      // payoff_matrix: [[1,2,3,4],[1,2,4,1],[3,5,2,2]],
      fully_revealed: true,
      instruction_text: markdown(`
        # Instructions

        ${text}
      `)
    }
    if (i == 2) {
      x.probabilities = [0.21, 0.18, 0.04, 0.57]
    }
    return x
  })


  function size2d(X) {
    return [X.length, X[1].length]
  }
  function randint(high) {
    return Math.floor(Math.random() * high);
  }
  function argmax(arr) {
    return arr.indexOf(Math.max(...arr))
  }

  var comprehension_instructions = function() {
    return markdown(`
      # Comprehension check

      Please answer the question below the table. You will earn 25 points (5 cents) for each correct answer!
      <br>Your current bonus is $${compute_bonus().toFixed(2)}.

      ### Reminders
      - Your payoff is the value in the table corresponding to the option/column you choose and
        the randomly selected color/row.
      - The first column tells you how many balls of each color are in the
        jar. The more balls of one color there are, the more likely that color/row is to be
        chosen.

    `)
  }

  var checkFailure = function(data) {
    if (!data.correct) {
      console.log("FAILED")
      $('#jspsych-target').remove()
      $('#submit-failed').click(submitHit)
      $('#test-failed').show()

    }
  }

  var check1 = _.range(PARAMS.n_comprehension).map(i => {
    var trial = TRIALS.standard.pop()
    var [n_outcome, n_gamble] = size2d(trial.payoff_matrix)
    var outcome = [2,3,1][i]
    var gamble = [0,2,5][i]

    return {
      trial_id: `check1_${i}`,
      ...TYPE.mouselab,
      ...trial,
      flag: `${outcome}/${gamble}`,
      fully_revealed: true,
      question: `
        <p class = "computer_number">
        What payoff will you receive if you select <span>Option ${gamble+1}</span> and a <span>${COLORS[outcome]}</span> ball is drawn?
        <br>(Enter a number e.g. "72" or "-102")
        </p>
        `,
      checkAnswer: function(answer) {
        var truth = trial.payoff_matrix[outcome][gamble]
        var correct = parseInt(answer) == truth
        if (correct) {
          console.log("correct", correct)
          TOTAL_POINTS += 25
        }
        return correct
      },
      callback: checkFailure,
      instruction_text: comprehension_instructions
    }
  })

  var check2 = _.range(PARAMS.n_comprehension).map(i => {
    var trial = TRIALS.standard.pop()
    var [n_outcome, n_gamble] = size2d(trial.payoff_matrix)
    var w = trial.probabilities
    var gamble = [4,1,3][i]
    var outcome = argmax(w)
    // make sure it is clearly higher than the others
    if (w[outcome] < 0.51) {
      w[outcome] += 0.04
      for (let j in w) {
        w[j] -= 0.01
      }
    }
    return {
      trial_id: `check2_${i}`,
      ...TYPE.mouselab,
      ...trial,
      flag: `${outcome}/${gamble}`,
      num_tries: 2,
      fully_revealed: true,

      question: `
        <p class = "computer_number">
        What payoff are you <i>most likely</i> to receive if you choose <span>Option ${gamble+1}?</span>,
        </p>`,
      checkAnswer: function(answer) {
        var truth = trial.payoff_matrix[outcome][gamble]
        var correct = parseInt(answer) == truth
        if (correct) {
          console.log("correct", correct)
          TOTAL_POINTS += 25
        }
        return correct
      },
      callback: checkFailure,
      instruction_text: comprehension_instructions
    }
  })

  var tell_bonus = function(data) {
    count_points(data)
    return `Your current bonus is $${compute_bonus().toFixed(2)}.`
  }

  var instruct2 = _.range(5).map(i => {
    var dominating = [false, true, false, true, true][i]
    var trial = (dominating ? TRIALS.dominating : TRIALS.standard).pop()
    return {
      trial_id: `instruct2_${i}`,
      flag: dominating ? 'dominating' : undefined,
      ...TYPE.mouselab,
      ...trial,
      fully_revealed: true,
      end_message: tell_bonus,
      instruction_text: markdown(`
        # Practice

        Well done! Now try to pick the gamble that will give you the most points!
        <b>These rounds count towards your bonus!</b>
        <br>(round ${i+1}/${PARAMS.n_dominating})
      `),
    }
  });

  var instruct3 = _.range(3).map(i => {
    var click_price = `But be careful! Each click will cost you ${make_points(PARAMS.cost)}.`
    return {
      trial_id: `instruct3_${i}`,
      ...TYPE.mouselab,
      ...TRIALS.standard.pop(),
      instruction_text: markdown(`
        # Instructions

        Nice! There's just one more thing. In the real game, all the payoffs
        are hidden at first. However, you can click on a cell to reveal that entry in the table.

        ${PARAMS.cost > 0 ? click_price : ''}

        For these practice rounds (which don't count towards your bonus),
        <br><b>click on at least 3 cells before making a decision!</b>
        <br>(round ${i+1}/3)
      `),
    }
  });

  var instruct4 = {
    type: "html-button-response",
    choices: ["Continue"],
    stimulus: function () {
      psiturk.finishInstructions()
      return markdown(`
        # Instructions

        That's it! Now you know how to play the gambling game. In the rest of the
        HIT, you will play ${PARAMS.n_trial} rounds of the game. These will all
        count towards your bonus.

        Remember, you will earn <b>one dollar for every ${PPD} points!</b>, rounded to the
        nearest cent. Your current bonus is $${compute_bonus().toFixed(2)}. Good luck!
      `)
    },
    timing_post_trial: 1000
  }

  var end_instruct = {
    type: "call-function",
    func: function() {
      INSTRUCT_DONE = true
      psiturk.finishInstructions()
    }
  }

  var trials = _.range(PARAMS.n_trial).map(i => {
    return {
      trial_id: `test_${i}`,
      ...TYPE.mouselab,
      ...TRIALS.standard.pop(),
      end_message: tell_bonus

    }
  });

  // var ask_age = {
  //   type: 'survey-text',
  //   preamble: '<h1>Demographics</h1>',
  //   questions: [
  //     {'prompt': 'What is your age?'},
  //     {'prompt': 'What is your gender?'},

  //   ]
  // }

  var demographics = {
    type: 'survey-html-form',
    preamble: "<h1>Demographics</h1>Please answer the following questions.",
    html: `
      <p>
        <b>What is your gender?</b><br>
        <input required type="radio" name="gender" value="male"> Male<br>
        <input required type="radio" name="gender" value="female"> Female<br>
        <input required type="radio" name="gender" value="other"> Other<br>
      </p>
      <p>
        <b>How old are you?</b><br>
        <input required type="number" name="age">
      </p>
      <p>
        <b>Select the highest level of education that applies to you.</b><br>
        <input required type="radio" name="education" value="none">No schooling completed<br>
        <input required type="radio" name="education" value="primary">Primary school (grades K-8) completed<br>
        <input required type="radio" name="education" value="secondary">Secondary school (grades 9-12) completed<br>
        <input required type="radio" name="education" value="college">Some college<br>
        <input required type="radio" name="education" value="college">College completed<br>
        <input required type="radio" name="education" value="grad">Graduate school completed<br>
      </p>
      <p>
        <b>How many dollars per hour do you think you make on MTurk?</b>
        <input required type="text" name="wage">
      </p>
    `
  };

  var debrief = {
    type: 'survey-text',
    preamble: function() {
      psiturk.recordUnstructuredData('bonus', compute_bonus());
      return markdown(`
        # Experiment Complete

        You have completed the Experiment. Your final bonus is $${compute_bonus().toFixed(2)}.
        If you have any comments, you can provide them below.

        You should receive your bonus within three days. If you don't, please contact us
        (cocosci.turk2@gmail.com) so that we can make sure you are fully compensated for your work!
      `)
    },
    button_label: 'Submit',
    questions: [
      {'prompt': 'Was anything confusing or hard to understand?',
       'rows': 2, columns: 60, value: 'No'},
      {'prompt': 'Any other comments?',
       'rows': 2, columns: 60, value:'No'}
    ]
  };

  /////////////////////////
  // Experiment timeline //
  /////////////////////////

  var timeline = [
    instruct0,
    ...instruct1,
    ...check1,
    ...check2,
    ...instruct2,
    ...instruct3,
    end_instruct,
    instruct4,
    ...trials,
    demographics,
    debrief,

  ];

  return startExperiment({
    timeline,
    exclusions: {
      min_width: 800,
      min_height: 600
    },
  });
}


