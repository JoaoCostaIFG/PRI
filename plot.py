#!/bin/python
import json
from numpy import NaN
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Load File
f = open('stories.json',)
data = json.load(f)
df = pd.DataFrame.from_dict(data, orient='columns')

# Set NaN to dead=false
df["dead"].fillna(False, inplace=True)

# Convert Unix timestamp to date
df["time"] = pd.to_datetime(df['time'], unit='s')


def groupby_month(df):
    return df.groupby(df['time'].dt.month)


def groupby_year(df):
    return df.groupby(df['time'].dt.year)


def groupby_trimester(df):
    return df.groupby(pd.Grouper(key='time', freq='3M'))


def groupby_hour(df):
    return df.groupby(df['time'].dt.hour)


def groupby_author(df):
    return df.groupby(df['by'])


def plot_top_count(df, N=50):
    top50 = df['id'].count().sort_values(ascending=False).head(N)
    top50.plot(kind="bar")
    plt.show()


def plot_top_posts_by_comment(df, N=50):
    df['kids'] = df['kids'].apply(len)
    top50 = df.sort_values(['kids'], ascending=False).head(N)
    print(top50.head())
    top50.plot(kind="bar", x="id", y="kids")
    plt.show()


def plot_top_posts_by_score(df, N=50):
    top50 = df.sort_values(['score'], ascending=False).head(N)
    top50.plot(kind="bar", x="id", y="score")
    plt.show()


def plot_count(df):
    df['id'].count().plot(kind="line")
    plt.show()


def plot_score(df):
    df['score'].mean().plot(kind="bar")
    plt.show()


def plot_dead(df):
    df.groupby("dead").size().plot(kind="bar")
    plt.show()


def plot_heatmap_score(df):
    median_score = df.groupby([df['time'].dt.hour, df['time'].dt.weekday])[
        'score'].mean().rename_axis(['hour', 'day']).reset_index()
    print(median_score)
    median_score = median_score.pivot(
        index='hour', columns='day', values='score')
    sns.heatmap(median_score, annot=True, fmt="g", cmap='viridis',
                xticklabels=["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])
    plt.show()


def score_box_plot(df):  # TODO maybe pass groupby by arg
    groupby_year(df).boxplot(subplots=False, rot=45, column=["score"])
    plt.show()


def comment_box_plot(df, groupby):
    df['kids'] = df['kids'].apply(len)  # TODO prob do always this?
    groupby(df).boxplot(subplots=False, rot=45, column=["kids"])
    plt.show()


# plot_dead(df)
# groupby_trimester(df)['id'].count().plot(kind="line")
# plot_count(groupby_trimester(df))
# plot_top_count(groupby_author(df))
# plot_top_posts_by_score(df)
# plot_top_posts_by_comment(df)
# plot_score(groupby_hour(df))
# plot_heatmap_score(df)
comment_box_plot(df, groupby_month)