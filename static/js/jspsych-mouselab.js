

jsPsych.plugins["mouselab"] = (function() {
    
    var revealed_points = [[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]]
    var EVs = [0,0,0,0,0,0]
    
    function make_points(x) {
      var unit = x == 1 ? 'Point' : 'Points'
      return x+' '+unit
    }
    function make_cents(x) {
      x = Math.round(x * 100)
      var unit = x == 1 ? 'cent' : 'cents'
      return x+' '+unit
    }

    var plugin = {};

    plugin.info = {
      name: "mouselab",
      parameters: {
        payoff_matrix: {
          type: jsPsych.plugins.parameterType.FLOAT,
          default: undefined
        },
        // cost_matrix: {
        //   type: jsPsych.plugins.parameterType.FLOAT,
        //   default: undefined
        // },
        probabilities: {
          type: jsPsych.plugins.parameterType.FLOAT,
          default: undefined
        },
        click_colors:{
          type: jsPsych.plugins.parameterType.STRING,
          default: ['#e83a3a']
        },
        show_legend:{
            type: jsPsych.plugins.parameterType.BOOL,
            default: false
        },
        game_height:{
            type: jsPsych.plugins.parameterType.INT,
            default: 380 //380
        },
        game_width:{
            type: jsPsych.plugins.parameterType.INT,
            default: 700 //700
        },
        instruction_text:{
            type: jsPsych.plugins.parameterType.STRING,
            default: ''
        },
        option_title:{
            type: jsPsych.plugins.parameterType.INT,
            default: '100 Balls'
        },
        option_labels:{
            type: jsPsych.plugins.parameterType.STRING,
            default: undefined
        }
      }
    }

    plugin.trial = function(display_element, trial) {
      TRIAL = trial;

      var start = Date.now()

      // data saving
      var data = {
          trial_id: trial.trial_id,
          problem_id: trial.id,
          flag: trial.flag,
          payoff_matrix: trial.payoff_matrix,
          cost: trial.cost,
          cost_matrix: trial.cost_matrix,
          probabilities: trial.probabilities,
          min_trial_secs: trial.min_trial_secs,
          display_EV: trial.display_EV,
          clicks: [],
          click_times: [],
          click_cost: 0,
          revealed_points: revealed_points,
          EVs: EVs
      };

      function make_click_vector(costs){
          num_features = trial.payoff_matrix.length
          num_gambles = trial.payoff_matrix[0].length
          var dict = {};
          for (rowi=1;rowi<num_features+1;rowi++){
              for (columni=1;columni<num_gambles+1;columni++){
                  curr_string = String(rowi) + String(columni)
                  dict[curr_string] = 0
              }
          }
          return dict
      }

      function sample_matrix(row_probabilities){
          var random_number = Math.random();
          prob_vector = [0]
          for (i=0;i<row_probabilities.length;i++){
              curr_prob = row_probabilities[i]
              previous_prob = prob_vector[i]
              prob_vector.push(curr_prob+previous_prob)
              if (prob_vector[i]<random_number && random_number<prob_vector[i+1]){
                  var sampled_option = i;
              }
          }
          return sampled_option
      }

      function get_column_index(row_number,columber_number,total_rows,header_included){
          if (header_included){
              return ((columber_number-1)*total_rows) + (row_number-1)
          } else {
              return (columber_number*total_rows) + (row_number)
          }
      }

      function get_row_index(row_number,column_number,total_columns,header_included){
          if (header_included){
              return ((row_number-1)*total_columns) + (column_number-1)
          } else {
              return (row_number*total_columns) + (column_number)
          }
      }

      function get_cost(row, col) {
        return (trial.cost != undefined) ? trial.cost : trial.cost_matrix[row-1][col-1]
      }
        
      function get_EVs(row, col) {
          if (trial.fully_revealed) {
              data.revealed_points = data.payoff_matrix
          }
          else {
              data.revealed_points[row-1][col-1] = data.payoff_matrix[row-1][col-1]
          }
          EVs = []
          for (c=0;c<data.revealed_points[0].length;c++){
              col_EV = 0
              for (r=0;r<data.revealed_points.length;r++){
                  col_EV += data.revealed_points[r][c]*data.probabilities[r]
              }
              EVs.push(Math.round(col_EV))
          }
          return EVs
      }
      
      function render_timer(costs,values,clicks,make_clickable,color_cost_dict,show_all){
          if (!trial.fully_revealed) {
              seconds_left = trial.min_trial_secs;
              can_bet = false;
              setTimeout(function(){disp_timer(costs,values,clicks,make_clickable,color_cost_dict,show_all);},0);
          }
          else {
              can_bet = true;
              render_table(costs,values,clicks,make_clickable,color_cost_dict,show_all)
          }
      }
        
      function disp_timer(costs,values,clicks,make_clickable,color_cost_dict,show_all){
            var interval = setInterval(function() {
                seconds_left--
                $("#timer-div").html(['You can bet in '+seconds_left+' seconds']);
                if (seconds_left <= 0) {
                    $("#timer-div").html(['']);
                    clearInterval(interval);
                    can_bet = true;
                    render_table(costs,values,clicks,make_clickable,color_cost_dict,show_all)
                }
            }, 1000);
            render_table(costs,values,clicks,make_clickable,color_cost_dict,show_all)
      }
        
      function render_table(costs,values,clicks,make_clickable,color_cost_dict,show_all){
            
            var M = trial.payoff_matrix
            var num_features = M.length
            var num_gambles = M[0].length
            // Make display Matrix
            table_html = '<table class="ml-table"style = "height:'+ml_table_height+';width:'+ml_table_width+'">'
            for (rowi=0;rowi<num_features+1;rowi++){
                curr_tr = '<tr id = "row' + String(rowi) +'">'
                    td_str = ''
                for (columni=0;columni<num_gambles+1;columni++){
                    if (rowi==0 && columni==0){
                        td_str += "<td class = 'features' id='"+String(rowi)+String(columni) + "'>100 Balls</td>"
                    } else if (rowi!=0 && columni==0){
                      var nb = Math.round(100*trial.probabilities[rowi-1])
                        td_str += "<td class = 'features' id='"+String(rowi)+String(columni) + "'>"+
                            String(nb) +" "+ String(trial.option_labels[rowi-1])+"</td>"
                    } else if (rowi==0 && columni!=0){
                        if (trial.display_EV && !trial.fully_revealed) {
                            if (trial.fully_revealed) {
                                data.EVs = get_EVs(0,0)
                            }
                            td_str += "<td class = 'options' id='"+String(columni) + "'>Option "+String(columni)+" value: "+String(data.EVs[columni-1])+"</td>"
                        }
                        else {
                            td_str += "<td class = 'options' id='"+String(columni) + "'>Option "+String(columni)+"</td>"
                        }
                    }
                    else{
                        curr_index = get_column_index(rowi,columni,num_features,true)
                        curr_index = get_row_index(rowi,columni,num_gambles,true)
                        var payoff = values[rowi-1][columni-1]
                        var cls = payoff < 0 ? 'negative uncovered' : 'uncovered'
                        if (show_all || trial.fully_revealed || clicks.includes(curr_index)){
                            td_str += `<td bgcolor='#E3E9F1' class = '${cls}' id='`+String(rowi)+String(columni) + "'>"+payoff+"</td>"
                        } else {
                            var curr_cost = get_cost(rowi, columni)
                            // costs[rowi-1][columni-1]
                            if (false){  // curr_cost==0
                                td_str += "<td bgcolor='#E3E9F1' class = 'uncovered' id='"+String(rowi)+String(columni) + "'>"+payoff+"</td>"
                            } else{
                                string_to_add = color_cost_dict[curr_cost]
                                td_str += "<td class = 'covered' bgcolor= '"+string_to_add+"' id='"+String(rowi)+String(columni) + "'></td>"
                            }
                        }
                    }
                }
                rowstr = curr_tr + td_str + '</tr>'
                table_html += rowstr
            }


            table_html += "</table></div></div>"
            document.getElementById('mouselab-table').innerHTML = table_html

            if (trial.cost > 0 && !trial.fully_revealed) {
              $('#click-div').html(`
                <p class = "computer_number">Total Click Cost: <span id="click_cost">${make_points(data.click_cost)}</span>
                </p>
              `)
            }
            if (!trial.fully_revealed && seconds_left > 0) {
              $("#timer-div").html(["You can bet in "+seconds_left+" seconds"]);
            }

              // if (running_click_cost!=1){
              //   document.getElementById('click-div').innerHTML = '<p class = "computer_number ">Total Click Cost: <span>' + running_click_cost +' Points</span></p>'
              // } else{
              //   document.getElementById('click-div').innerHTML = '<p class = "computer_number ">Total Click Cost: <span>' + running_click_cost +' Point</span></p>'
              // }


            // choice_html =  '<p class = "computer-number">The ball is <span>blue</span>. ' +
            // ' You win <span>0.00 points</span>. Net points (bonus minus click costs): <span>$0.00</span></p>'
            // document.getElementById('choice-div').innerHTML = choice_html

            if (make_clickable){
                $(".covered").hover(function() {
                  $(this).toggleClass('cells-hover-own')
                }
                )
                $(".covered").click(function() {
                    var curr_location = this.id;
                    var curr_row = parseInt(curr_location[0]);
                    var curr_col = parseInt(curr_location[1]);
                    var clicked_index = get_row_index(curr_row,curr_col,num_gambles,true)
                    data.click_times.push(Date.now() - start)
                    data.clicks.push(clicked_index)
                    data.click_cost += get_cost(curr_row, curr_col, clicked_index)
                    data.EVs = get_EVs(curr_row, curr_col)
                    render_table(costs,values,data.clicks,true,color_cost_dict,false)
                });


              $('.options').hover(function(){
                  $(this).toggleClass('options-hover');
                  col_number = this.id
                  for (j=1;j<=trial.payoff_matrix.length;j++){
                      curr_id = '#' + String(j) + col_number
                      $(curr_id).toggleClass('cells-hover');
                  }
              });

              if (can_bet){ //seconds_left<=0
                  $( ".options" ).click(function() {
                      var selected_column = parseInt(this.id);
                      // Note that this return items with indexing starting at 0, and the first row of the actual matrix is a header
                      var outcome = sample_matrix(trial.probabilities);
                      var outcome_row = outcome+1;

                      var payoff = values[outcome][selected_column-1]

                      var id_string = String(outcome_row) + this.id
                      render_table(costs,values,data.clicks,false,color_cost_dict,true)
                      document.getElementById(id_string).style.border = "6px solid black";

                      data.rt = Date.now() - start
                      data.choice_index = selected_column-1
                      data.payoff_index = outcome
                      data.payoff_value = payoff
                      data.net_payoff = payoff - data.click_cost


                      var verb = payoff > 0 ? "win" : "lose"

                      if (trial.cost > 0 && !trial.fully_revealed) {
                        $('#choice-div').append(`<p class = "computer_number">
                          The ball is <span>${trial.option_labels[outcome]}</span>, so you ${verb} <span>${make_points(Math.abs(payoff))}.</span>
                          <p class = "computer_number">
                          Net Earnings: <span>${make_points(payoff-data.click_cost)}</span>.
                          That's about ${make_cents(trial.bonus_rate * Math.abs(payoff - data.click_cost))}.
                        `)
                      } else {
                        $('#choice-div').append(`<p class = "computer_number">
                          The ball is <span>${trial.option_labels[outcome]}</span>, so you ${verb} <span>${make_points(Math.abs(payoff))}.</span>
                          <p>
                          That's about ${make_cents(trial.bonus_rate * Math.abs(payoff - data.click_cost))}.
                        `)
                      }

                      if (trial.end_message != undefined) {
                        $('#choice-div').append(`<p>${trial.end_message(data)}</p>`)
                      }

                      document.getElementById('choice-div').style.visibility = "visible";
                      document.getElementById('continue').style.visibility = "visible";

                      $("#continue").click(function() {
                        if (trial.callback != undefined) {
                          trial.callback(data)
                        }
                        jsPsych.finishTrial(data);
                      });
                  });
              }


            } else {
                $('.options').css( 'cursor', 'default' );
                $('.covered').css( 'cursor', 'default' );
            }

      }

      ml_table_width = String(trial.game_width)+'px'
      ml_table_height = String(trial.game_height)+'px'
      ml_container_height = String(trial.game_height)+'px'

      if (trial.show_legend){
        ml_container_width = String(trial.game_width+200)+'px'
        display_element.innerHTML = '<div id = "instructions"></div>' +
        '<div id="ml-container" style = "height:'+ml_container_height+';width:'+ml_container_width+';"> '+
        '<div id="mouselab-table" style = "height:'+ml_table_height+';width:'+ml_table_width+'; float: left"> </div>' +
        '<div id="mouselab-legend" style = "height:'+ml_table_height+';width:200px;float: right"> </div>' +
        '</div>' +
        '<div id="click-div"></div>'+
        '<div id="timer-div"></div>'+
        '<div id="choice-div"></div>'
      } else{
        ml_container_width = String(trial.game_width)+'px'
        display_element.innerHTML = '<div id = "instructions"></div>' +
        '<div id="ml-container" style = "height:'+ml_container_height+';width:'+ml_container_width+';"> '+
        '<div id="mouselab-table" style = "height:'+ml_table_height+';width:'+ml_table_width+';float:center"> </div>' +
        '</div>' +
        '<div id="click-div"></div>'+
        '<div id="timer-div"></div>'+
        '<div id="choice-div"></div>'
      }

      if (trial.question == undefined) {
        data.revealed_points = [[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]]
        data.EVs = [0,0,0,0,0,0]
        button_html = "<button id='continue' class='jspsych-btn'> Continue </button>"
        display_element.innerHTML += button_html
        document.getElementById('continue').style.visibility = "hidden";

      }

      function make_legend(color_cost_dict) {
          if (trial.different_clicks==true){
            title_str = '<p>Number of clicks </br> to uncover box</p>'
          } else{
            title_str = '<p>Number of points </br> to uncover box</p>'
          }

          var container = document.getElementById('mouselab-legend');
          document.getElementById('mouselab-legend').innerHTML = title_str
          for (var key in color_cost_dict) {
              var boxContainer = document.createElement("DIV");
              var box = document.createElement("DIV");
              var label = document.createElement("SPAN");
              label.className ='legend-text'
              curr_label = ' &nbsp; ' + String(key)
              label.innerHTML = curr_label;
              box.className = "box";
              box.style.backgroundColor = color_cost_dict[key];
              boxContainer.appendChild(box);
              boxContainer.appendChild(label);
              container.appendChild(boxContainer);
         }
      };



      var all_costs = trial.cost != undefined ? [trial.cost] : trial.cost_matrix.flat()
      var ordered_costs = [...new Set(all_costs)].sort()
      var color_dict=  {};
      for (color_i=0;color_i<trial.click_colors.length;color_i++){
          curr_cost = ordered_costs[color_i]
          curr_color = trial.click_colors[color_i]
          color_dict[curr_cost] = curr_color
      }

      if (trial.show_legend==true){
        make_legend(color_dict)
      }
      document.getElementById('instructions').innerHTML = trial.instruction_text
      document.getElementById('choice-div').style.visibility = "hidden";

      click_values = make_click_vector(trial.cost_matrix)
      var clickable = trial.question == undefined;
      render_timer(trial.cost_matrix,trial.payoff_matrix,data.clicks,clickable,color_dict,false)


      async function do_demo(trial, cost_dict) {
        delay = trial.delay;
        console.log('demo')
        let clicks = []
        for (let c of trial.demo.clicks) {
          console.log('click', c);
          await sleep(delay)
          clicks.push(c);
          render_timer(trial.cost_matrix,trial.payoff_matrix,clicks,true,color_dict,false)
        }
        await sleep(delay)

        // highlight choice
        let col_number = trial.demo.choice + 1
        $(`#${col_number}`).toggleClass('options-hover');
        console.log('choose', $(`#${col_number}`))
        for (let j=1;j<=trial.payoff_matrix.length;j++){
            let curr_id = '#' + String(j) + col_number
            $(curr_id).toggleClass('cells-hover');
        }

        document.getElementById('choice-div').style.visibility = "visible";
        document.getElementById('continue').style.visibility = "visible";
        $("#continue").click(function() {
          if (trial.callback != undefined) {
            trial.callback(data)
          }
          jsPsych.finishTrial(data);
        });
      }
      
      if (trial.demo) {
        do_demo(trial, color_dict)
      }

      if (trial.question) {
        $(display_element).append(
          `<p class=mouselab-question>${trial.question}</p>
          <input type='text' id='answer'/>
          <br>
          <p id='answer-incorrect'>
            Incorrect. <span id='attempts-remaining'/> attempt(s) remaining.
          </p>
          <br>
          <button id='submit' class='jspsych-btn'>Submit</button>
          <br><br>&nbsp;
          `
        )
        $('#answer-incorrect').hide()
        var attempts_left = trial.num_tries || 3;
        data.answers = []

        $("#submit").click(function() {
          var answer = $('#answer').val()
          data.answers.push(answer)
          data.correct = trial.checkAnswer(answer)

          if (!data.correct && attempts_left > 1) {
            attempts_left -= 1
            $('#answer-incorrect').show()
            $('#answer').val("")
            // alert(`Incorrect! You have ${attempts_left} attempts remaining.`)
          $('#attempts-remaining').html(String(attempts_left))
          } else {
            if (trial.callback != undefined) {
              trial.callback(data)
            }
            jsPsych.finishTrial(data);
          }

        });
      }

    };

    return plugin;
  })();
