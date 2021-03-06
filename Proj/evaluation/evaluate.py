#!/bin/python

from string import ascii_uppercase as alphabet
import sys
import json


def ap(docs, n=10):
    """Average Precision"""
    precision_values = [
        len([
            doc
            for doc in docs[:idx]
            if doc["relevant"] == "true"
        ]) / idx
        for idx in range(1, n + 1)
    ]
    return sum(precision_values) / len(precision_values)


def ap(docs, n=10):
    """Average Precision"""
    precision_values = [
        len([
            doc
            for doc in docs[:idx]
            if doc["relevant"] == "true"
        ]) / idx
        for idx in range(1, n + 1)
    ]
    return sum(precision_values) / len(precision_values)


def p10(docs, n=10):
    """Precision at N"""
    return len([doc for doc in docs[:n] if doc['relevant'] == "true"]) / n


def rec(docs, n=10):
    """Recall"""
    len_relevant = getNoRelevants(docs)
    return len([
        doc for doc in docs[:n]
        if doc['relevant'] == "true"
    ]) / len_relevant


def fB(docs, beta, n=10):
    """F1 Score"""
    precision = p10(docs, n)
    recall = rec(docs, n)
    return (1 + beta ** 2) * (precision * recall) / ((beta ** 2 * precision) + recall)


def getNoRelevants(docs):
    return sum([doc["relevant"] == "true" for doc in docs])


def gen_precisions(docs, n=10):
    return [getNoRelevants(docs[:idx]) / idx
            for idx, _ in enumerate(docs[:n], start=1)]


def gen_recalls(docs, n=10):
    len_relevant = getNoRelevants(docs)
    return [
        len([
            doc for doc in docs[:idx]
            if doc['relevant'] == "true"
        ]) / len_relevant
        for idx, _ in enumerate(docs[:n], start=1)
    ]


def get_precision_recalls(docs, n=10):
    import numpy as np

    recall_values = gen_recalls(docs, n)
    precision_values = gen_precisions(docs, n)

    # Let's scatterplot all recall-precision values
    # And lineplot using sklearn the curve with intermediate steps
    recall_precision_dict = {
        recall_values[i]: precision_values[i] for i in range(len(recall_values))}

    # Extend recall_values to include traditional steps for a better curve(0.1, 0.2 ...)
    extended_recall = recall_values.copy()
    extended_recall.extend([step for step in np.arange(
        0.1, 1.1, 0.1) if step not in recall_values])
    extended_recall = sorted(set(extended_recall))

    # Extend matching dict to include these new intermediate steps
    for idx, step in enumerate(extended_recall):
        if step not in recall_precision_dict:  # If we don't have info on this step
            if extended_recall[idx-1] in recall_precision_dict:
                recall_precision_dict[step] = recall_precision_dict[extended_recall[idx-1]]
            else:
                recall_precision_dict[step] = recall_precision_dict[extended_recall[idx+1]]

    # Values with 0 must be verified, idk why
    if 0 not in recall_precision_dict:
        recall_precision_dict[0] = recall_precision_dict[0.1]

    return recall_values, precision_values, recall_precision_dict


# Plots multiple recall-precision plots, for each doc
def plot_recall_precision(recalls_precisions, legends=[], markers=["s", "o", "^", "D"]):
    import matplotlib.pyplot as plt
    from sklearn.metrics import PrecisionRecallDisplay
    a = plt.figure()
    axes = a.add_axes([0.1, 0.1, 0.8, 0.8])

    # Use dict with extended values to draw line
    i = 0
    for recalls, precisions, recall_dict in recalls_precisions:
        recall_keys = sorted(list(recall_dict.keys()))
        precision_values = [recall_dict[key] for key in recall_keys]

        disp = PrecisionRecallDisplay(precision_values, recall_keys)
        d = disp.plot(ax=axes)
        axes.set_ylim([-0.01, 1.01])
        # plt.scatter(recalls, precisions, marker=markers[i])
        i += 1

    # Need to set scatter plots to no_legend
    # insert_legends = []
    # for legend in legends:
        # insert_legends.append(legend)
        # insert_legends.append('_nolegend_')

    plt.gca().legend((legends))
    plt.tight_layout()
    plt.savefig("precision_recall", bbox_inches='tight')
    plt.show()


def calc_metrics(data):
    print("Average Precision: {:.2%}".format(ap(data["docs"])))
    print("P@10: {:.2%}".format(p10(data["docs"])))
    print("Recall: {:.2%}".format(rec(data["docs"])))
    print("F??: {:.2%}".format(fB(data["docs"], 0.5)))


""" Checks if a document has an unset relevance score"""


def check_doc(docs, label):
    def has_relevancy(doc):
        return doc["relevant"] == "true" or doc["relevant"] == "false"

    for i in range(len(docs)):
        if not has_relevancy(docs[i]):
            print("File " + label + ", document no " +
                  str(i) + " has invalid relevant type")
            exit(1)


def usage():
    print("Usage: ./evaluate.py <qrel1 label1 qrel2 label2 ...>")
    exit(-1)


if len(sys.argv) == 1:
    usage()

jsons = []
labels = []
for i in range(1, len(sys.argv[1:]), 2):
    # Load args
    file = sys.argv[i]
    label = sys.argv[i + 1]
    # Load json
    f = open(file)
    data = json.load(f)
    # Check doc validity
    check_doc(data["docs"], file)

    jsons.append(data)
    id = alphabet[i // 2]
    labels.append(str("System " + id + " - " + label))

recalls_precisions = []
for data in jsons:
    calc_metrics(data)
    recalls_precisions.append(get_precision_recalls(data["docs"]))

plot_recall_precision(recalls_precisions, labels)
