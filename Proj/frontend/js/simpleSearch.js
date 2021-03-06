class FilterButton {
  constructor($button, filter) {
    this.$button = $button;
    this.filter = filter;
    this.setCount(0);
  }

  getButton() {
    return this.$button;
  }

  getFilter() {
    return this.filter;
  }

  getCount() {
    return this.count;
  }

  activate() {
    this.$button.addClass("filterButtonActive");
  }

  deactivate() {
    this.$button.removeClass("filterButtonActive");
  }

  setCount(count) {
    this.count = count;
    if (count === 0) {
      this.$button.prop("disabled", true);
      this.$button.find(".filterHits").empty();
      this.deactivate();
    } else {
      this.$button.prop("disabled", false);
      this.$button.find(".filterHits").empty().text(`(${count})`);
    }
  }
}

class State {
  constructor($container, $template) {
    this.$container = $container;
    this.$template = $template;
    this.filter = this.lastFilter = "all";
    this.queryData = {
      fl: "id, story_id, story_author, story_descendants, story_score, story_time, story_title, story_text, url, url_text",
      wt: "json",
      indent: "false",
      defType: "edismax",
      rows: 10,
      facet: true,
      "facet.query": "newssite_filter:news",
      "facet.field": "story_type",
      hl: true,
      "hl.fl": "story_title, story_text, url_text",
      "hl.method": "unified",
    };
    this.filterButtons = new Map();
  }

  getFilter() {
    return this.filter;
  }

  getLastFilter() {
    return this.lastFilter;
  }

  setFilter(filter) {
    this.lastFilter = this.filter;
    this.filter = filter;

    switch (this.filter) {
      case "normal":
      case "askhn":
      case "showhn":
      case "launchhn":
        this.queryData["fq"] = "story_type:" + this.filter;
        break;
      case "news":
        this.queryData["fq"] = "newssite_filter:news";
        break;
      default:
        delete this.queryData["fq"];
        break;
    }

    this.search();
  }

  filterChanged() {
    let changed = this.lastFilter !== this.filter;
    this.lastFilter = this.filter;
    return changed;
  }

  addFilterButton($button, filter) {
    let fb = new FilterButton($button, filter);
    this.filterButtons.set(filter, fb);
    $button.click(this.setFilter.bind(this, fb.getFilter()));
    fb.deactivate();
  }

  setLoadMoreButton($button) {
    this.loadMoreBtn = $button;
    $button.click(this.loadMore.bind(this));
    this.loadMoreBtn.hide();
  }

  loadMore() {
    this.queryData["rows"] += 10;
    this.search();
  }

  setQueryStr(queryStr) {
    console.log(queryStr);
    this.queryData["q"] = queryStr;
    $("#query").val(this.queryData["q"]);
  }

  advancedSearch() {
    function setAdvQuery($input, field) {
      if ($input.val()) return `+${field}:${$input.val()} `;
      else return "";
    }

    let advQuery = "";
    advQuery += setAdvQuery($("#advTitle"), "story_title");
    advQuery += setAdvQuery($("#advBody"), "story_text");
    advQuery += setAdvQuery($("#advComments"), "comments.comment_text");
    advQuery += setAdvQuery($("#advAuthor"), "story_author");
    advQuery += setAdvQuery($("#advUrl"), "url");
    advQuery += setAdvQuery($("#advUrlText"), "url_text");

    if (advQuery.length == 0) return;

    let oldQuery = this.queryData["q"];
    this.queryData["q"] = advQuery;

    this.search(false);

    this.queryData["q"] = oldQuery;
  }

  search(doSpellcheck) {
    if (doSpellcheck === undefined) doSpellcheck = true;

    if (!this.queryData["q"] || this.queryData["q"].length === 0) return;

    // reset load button
    if (this.filterChanged()) {
      this.queryData["rows"] = 10;
    }

    let sorts = $("#sortDropdown")["0"].options;
    switch (sorts[sorts.selectedIndex].value) {
      case "newest":
        this.queryData["sort"] = "story_time desc";
        break;
      case "oldest":
        this.queryData["sort"] = "story_time asc";
        break;
      case "highest":
        this.queryData["sort"] = "story_score desc";
        break;
      case "lowest":
        this.queryData["sort"] = "story_score asc";
        break;
      case "off":
      default:
        delete this.queryData["sort"];
        break;
    }

    console.log(this.queryData);
    $.ajax({
      type: "GET",
      url: "http://localhost:8983/solr/hackersearch/select",
      dataType: "json",
      data: this.queryData,
      success: this.renderResults.bind(this, doSpellcheck),
    });
  }

  renderResults(doSpellcheck, data) {
    console.log(data);
    let response = data.response;
    let highlight = data.highlighting;
    let facet = data.facet_counts;
    // only use spellcheck if there's any
    let spellcheck;
    if (data.spellcheck === undefined) doSpellcheck = false;
    else spellcheck = data.spellcheck.collations;

    let didYouMean = $("#didYouMean");
    if (!doSpellcheck) {
      didYouMean.hide();
    } else if (spellcheck.length >= 2) {
      // has spellcheck suggestion
      didYouMean.find("a").empty().append(spellcheck[1]);
      didYouMean.show();
    } else {
      didYouMean.hide();
    }

    function arrayNextElem(array, elem) {
      let idx = array.findIndex((e) => e === elem);
      if (idx < 0 || idx + 1 >= array.length) return 0;
      return array[idx + 1];
    }

    if (this.filter === "all") {
      this.filterButtons.get("all").setCount(response.numFound);
      this.filterButtons
        .get("normal")
        .setCount(arrayNextElem(facet.facet_fields.story_type, "normal"));
      this.filterButtons
        .get("askhn")
        .setCount(arrayNextElem(facet.facet_fields.story_type, "askhn"));
      this.filterButtons
        .get("showhn")
        .setCount(arrayNextElem(facet.facet_fields.story_type, "showhn"));
      this.filterButtons
        .get("launchhn")
        .setCount(arrayNextElem(facet.facet_fields.story_type, "launchhn"));
      this.filterButtons
        .get("news")
        .setCount(facet.facet_queries["newssite_filter:news"]);
    }

    // set active button
    this.filterButtons.forEach((value, _) => {
      value.deactivate();
    });
    this.filterButtons.get(this.filter).activate();

    $("#queryInfo")
      .empty()
      .text(
        `Showing ${response.docs.length} results out of ${response.numFound}.`
      );
    if (response.docs.length < response.numFound) this.loadMoreBtn.show();
    else this.loadMoreBtn.hide();

    // the results
    this.$container.empty(); // if there are any previous results, remove them
    response.docs.forEach(function (doc, i) {
      let hl = highlight[doc.id];
      let result = this.$template.clone();

      // small division every 10 items (load more results)
      if (i > 0 && i % 10 == 0) this.$container.append("<hr>");

      // title
      let storyUrl = "https://news.ycombinator.com/item?id=" + doc.story_id;
      let title = hl.story_title[0] ? hl.story_title[0] : doc.story_title;
      result.find(".title > a").prop("href", storyUrl).append(title);
      // url (show only the domain)
      let url = doc.url ? doc.url : storyUrl; // stome stories don't have an URL
      result
        .find(".url")
        .prop("href", url)
        .text(`(${new URL(url).hostname})`);
      // story content
      let content = doc.story_text
        ? maxWords(hl.story_text[0] ? hl.story_text[0] : doc.story_text, 30)
        : maxWords(hl.url_text[0] ? hl.url_text[0] : doc.url_text, 30);
      result.find(".content").append(content);
      // footer
      result
        .find(".result-footer")
        .text(
          `${doc.story_score} points | ${doc.story_author} | ${doc.story_descendants} comments`
        );

      result.removeClass("template");
      this.$container.append(result);
    }, this);
  }
}

let state;

// doc ready
$(function () {
  state = new State($("#results"), $(".template.result"));

  // performs search when 'enter' key is pressed
  $("#query").keypress(function (event) {
    if (event.which === 13) {
      state.setQueryStr.bind(state)($("#query").val());
      state.search.bind(state)();
    }
  });
  state.setQueryStr($("#query").val());

  $("#search").click(function () {
    state.setQueryStr.bind(state)($("#query").val());
    state.search.bind(state)();
  });
  $("#query").on("keyup", suggestions);
  suggestions();

  $("#advanced-search").click(state.advancedSearch.bind(state));

  state.addFilterButton($("#allFilter"), "all");
  state.addFilterButton($("#normalFilter"), "normal");
  state.addFilterButton($("#askFilter"), "askhn");
  state.addFilterButton($("#showFilter"), "showhn");
  state.addFilterButton($("#launchFilter"), "launchhn");
  state.addFilterButton($("#newsFilter"), "news");

  state.setLoadMoreButton($("#loadMore"));

  let didYouMean = $("#didYouMean");
  didYouMean.find("a").click(function () {
    state.setQueryStr.bind(state)(didYouMean.find("a").text());
    state.search.bind(state)();
  });
  didYouMean.hide();

  let sorts = $("#sortDropdown");
  sorts[0].options.selectedIndex = 0; // reset selected options on page load
  sorts.change(state.search.bind(state));
});

function suggestions() {
  let val = $("#query").val();
  if (val.length === 0) {
    $("#suggestions").empty();
    $("#altSuggestions").empty();
    return;
  }
  $.ajax({
    type: "GET",
    url: "http://localhost:8983/solr/hackersearch/suggest",
    dataType: "json",
    data: { q: val },
    success: function (data) {
      let suggBox = $("#suggestions");
      suggBox.empty();
      let suggs = data.suggest.mySuggester[val];
      for (let i = 0; i < suggs.numFound; ++i) {
        suggBox.append(`<p>${suggs.suggestions[i].term}</p>`);
      }

      let altSuggBox = $("#altSuggestions");
      altSuggBox.empty();
      let altSuggs = data.suggest.altSuggester[val];
      for (let i = 0; i < altSuggs.numFound; ++i) {
        altSuggBox.append(`<span>${altSuggs.suggestions[i].term}  </span>`);
      }
    },
  });
}

// Cuts off lengthy content to a given maximum number of words
// Input: string of words, maximum number of words
// Effects: none
// Output: the trimmed words
function maxWords(content, max) {
  let words = content.split(" ", max);
  let cutContent = "";
  for (let idx = 0; idx < words.length; idx++) {
    cutContent += words[idx];
    cutContent += idx + 1 == words.length ? "" : " ";
  }
  return cutContent + "...";
}
