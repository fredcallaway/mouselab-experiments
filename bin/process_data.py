#!/usr/bin/env python3

import numpy as np
import pandas as pd
from argparse import ArgumentParser, ArgumentDefaultsHelpFormatter
import boto3
from ast import literal_eval
import os
import re

def to_snake_case(name):
    name = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    name = re.sub(r'[.:\/]', '_', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', name).lower()

def approve_and_bonus(idents):
    cost = 0
    client = boto3.client('mturk',
        aws_access_key_id='REDACTED',
        aws_secret_access_key='REDACTED',
        region_name='us-east-1'
    )

    for row in idents.itertuples():
        print(row.worker_id, row.assignment_id, end='   ')
        try:
            res = client.get_assignment(AssignmentId=row.assignment_id)
            if res['Assignment']['AssignmentStatus'] != 'Approved':
                client.approve_assignment(AssignmentId=row.assignment_id)
                print('newly approved     ', end='   ')
                cost += 0.25
            else:
                print('previously approved', end='   ')
                cost += 0.25

            res = client.list_bonus_payments(AssignmentId=row.assignment_id)
            if res['NumResults'] > 0:
                print(f'previously bonused {row.bonus:.2f}', end='   ')
                cost += row.bonus
            else:
                if row.bonus < 0.005:
                    print('no bonus', end='   ')
                else:
                    client.send_bonus(
                        AssignmentId=row.assignment_id,
                        WorkerId=row.worker_id,
                        Reason='Thanks for participating!',
                        BonusAmount=f'{row.bonus:.2f}'
                    )
                    print(f'newly bonused {row.bonus:.2f}', end='   ')
                    cost += row.bonus
            print()
        except Exception:
            print('ERROR')

    cost *= 1.2
    print(f"TOTAL COST: ${cost:.2f}")

def get_data(version):
    pdf = pd.read_csv(f'data/human/{version}/participants.csv').set_index('pid')
    pdf.rename(columns=to_snake_case, inplace=True)

    df = pd.read_csv(f'data/human/{version}/mouselab.csv')
    df[['block', 'trial_index']] = df.pop('trial_id').str.split('_', expand=True)
    df.set_index('pid', inplace=True)

    try:
        raw_form = pd.read_csv(f'data/human/{version}/survey-html-form.csv')
        form = pd.DataFrame(list(raw_form.responses.apply(literal_eval))).set_index(raw_form.pid)
        completed = form.index  # the form is at the end, only have data if they got that far
        pdf = pdf.loc[completed].join(form)
        df = df.loc[completed]
    except FileNotFoundError:
        # pilot versions
        return pdf, df

    # comprehension checks
    is_check = df.block.str.startswith('check')
    check = df.loc[is_check].copy()
    df = df.loc[~is_check].copy()
    # check['attempts'] = check.answers.apply(literal_eval).apply(len)
    check.correct = check.correct.astype(float)
    pdf[['pass_check1', 'pass_check2']] = check.groupby(['pid', 'block']).correct.mean().unstack()

    for k in ['trial_index', 'click_cost', 'payoff_value', 'choice_index', 'payoff_index', 'cost', 'net_payoff']:
        df[k] = df[k].astype(int)

    for k in ['sigma', 'mu', 'cost']:
        pdf[k] = pdf[k].astype(int)

    df['sigma'] = pdf.sigma  # convenience
    df['alpha'] = pdf.alpha
    pdf.drop(['n_trial', 'n_dominating'], axis=1, inplace=True)

    # survey = pd.read_csv(f'data/human/{version}/survey-text.csv')
    # pdf['total_time'] = survey.time_elapsed / 60000

    return pdf, df

def main(version, approve):
    pdf, df = get_data(version)

    if approve:
        idents = pd.read_csv(f'data/human_raw/{version}/identifiers.csv').set_index('pid').loc[pdf.index]
        idents['bonus'] = pdf.bonus
        approve_and_bonus(idents)

    if version != '1.0':
        return # just for paying them bonusing


    pdf['pass_instruct1'] = df.query('block == "instruct1"')\
        .choice_index.groupby('pid')\
        .apply(lambda x: np.mean(x.values == [0, 2, 5]))

    def choose_dominating(row):
        X = np.array(literal_eval(row.payoff_matrix))
        correct = X.sum(0).argmax()
        return row.choice_index == correct

    pdf['pass_instruct2'] = df.query('flag == "dominating"')\
        .apply(choose_dominating, axis=1)\
        .groupby('pid').mean()

    n_click = df.query('block == "instruct3"').clicks.apply(literal_eval).apply(len)
    pdf['pass_instruct3'] = n_click.groupby('pid').apply(lambda x: np.mean(x.values >= 3))

    pdf['instruct_time'] = df.query('block == "test" and trial_index == 0').time_elapsed / 60000


    path = f'data/processed/{version}'
    os.makedirs(path, exist_ok=True)
    pdf.to_csv(f'{path}/participants.csv')
    print(f'Wrote {path}/participants.csv')
    df.to_csv(f'{path}/trials.csv')
    print(f'Wrote {path}/trials.csv')


# %% ====================  ====================

if __name__ == '__main__':
    parser = ArgumentParser(formatter_class=ArgumentDefaultsHelpFormatter)
    parser.add_argument("version")
    parser.add_argument("--skip_approve", action='store_true')
    args = parser.parse_args()
    main(args.version, not args.skip_approve)

