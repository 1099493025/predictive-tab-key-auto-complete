/*global chrome*/
(function () {
    'use strict';

    const DYNAMIC_DICTIONARY_LIMIT = 1000000;

    var natural = require('natural'),
        dictionary = {
            dynamic: new natural.Trie(false),
            static: new natural.Trie(false)
        },
        preservedInput = Object.create(null),
        xhr = new XMLHttpRequest();

    function preservedInputAdd(word) {
        if (!preservedInput[word.toLowerCase()]) {
            preservedInput[word.toLowerCase()] = {
                frequency: 1,
                word: word,
                next: {}
            };
        } else {
            preservedInput[word.toLowerCase()].frequency += 1;
        }
    }

    function suffixPredictor(prefix) {
        var withPrefixWords = dictionary.dynamic.keysWithPrefix(prefix)
            .slice(0, DYNAMIC_DICTIONARY_LIMIT / 100);

        if (!withPrefixWords || !withPrefixWords.length) {
            withPrefixWords = dictionary.static.keysWithPrefix(prefix);
        }

        if (!withPrefixWords || !withPrefixWords.length) {
            return;
        }

        withPrefixWords.joined = withPrefixWords.join(' ');

        withPrefixWords = withPrefixWords
            .filter(function (word) {
                return word !== prefix &&
                        !withPrefixWords.joined.match(new RegExp('\\b' + word + '[^ ]\\b'));
            })

            .sort(function (wordA, wordB) {
                if (preservedInput[wordA].frequency <
                        preservedInput[wordB].frequency) {
                    return 1;
                }

                if (preservedInput[wordA].frequency >
                        preservedInput[wordB].frequency) {
                    return -1;
                }

                if (natural.JaroWinklerDistance(prefix, wordA) <
                        natural.JaroWinklerDistance(prefix, wordB)) {
                    return 1;
                }

                if (natural.JaroWinklerDistance(prefix, wordA) >
                        natural.JaroWinklerDistance(prefix, wordB)) {
                    return -1;
                }

                return 0;
            });

        withPrefixWords = withPrefixWords.shift();

        if (withPrefixWords) {
            return preservedInput[withPrefixWords].word
                .replace(new RegExp('\\b' + prefix, 'i'), '');
        }
    }

    function nextWordPredictor(previousWord) {
        var nextWord = {maxFrequency: 0, word: null};

        if (!preservedInput[previousWord]) {
            return;
        }

        Object.keys(preservedInput[previousWord].next).forEach(function (word) {
            if (preservedInput[previousWord].next[word] &&
                    preservedInput[previousWord].next[word] > nextWord.maxFrequency) {

                nextWord.maxFrequency = preservedInput[previousWord].next[word];
                nextWord.word = word;
            }
        });

        if (nextWord.word) {
            return nextWord.word;
        }
    }

    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE &&
                xhr.status === 200) {

            JSON.parse(xhr.responseText).forEach(function (word) {
                dictionary.static.addString(word);
                preservedInputAdd(word);
            });
        }
    };

    xhr.open('GET', chrome.extension.getURL('dictionary.json'), true);
    xhr.send();

    chrome.runtime.onInstalled.addListener(function () {
        chrome.tabs.query({}, function (tabs) {
            tabs.forEach(function (tab) {
                chrome.tabs.reload(tab.id);
            });
        });
    });

    chrome.runtime.onConnect.addListener(function (port) {
        if (port.name === 'insert') {
            port.onMessage.addListener(function insert(words) {
                if (preservedInput.size >= DYNAMIC_DICTIONARY_LIMIT) {
                    chrome.runtime.onConnect.removeListener(insert);
                    return;
                }

                words.slice(0, DYNAMIC_DICTIONARY_LIMIT / 100).forEach(function (word, index) {
                    preservedInputAdd(word);

                    if (words[index + 1]) {
                        if (!preservedInput[word.toLowerCase()].next[words[index + 1]]) {
                            preservedInput[word.toLowerCase()]
                                .next[words[index + 1]] = 1;
                        } else {
                            preservedInput[word.toLowerCase()]
                                .next[words[index + 1]] += 1;
                        }
                    }

                    dictionary.dynamic.addString(word);
                });
            });
        } else if (port.name === 'query') {
            port.onMessage.addListener(function (query) {
                if (query.prefix) {
                    var suffix = suffixPredictor(query.prefix);

                    if (suffix) {
                        port.postMessage({
                            query: query.prefix,
                            word: suffix
                        });
                    }
                } else if (query.previousWord) {
                    var nextWord = nextWordPredictor(query.previousWord);

                    if (nextWord) {
                        port.postMessage({
                            query: query.previousWord,
                            word: nextWord
                        });
                    }
                }
            });
        }
    });
}());