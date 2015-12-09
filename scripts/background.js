/*global chrome*/
(function () {
    'use strict';
    var DICTIONARY_LIMIT = 1000000;
    var natural = require('natural');
    var preserveCase = new Map();
    var dictionary = {dynamic: new natural.Trie(false), static: new natural.Trie(false)};
    var xhrOfflineDictionary = new XMLHttpRequest();
    xhrOfflineDictionary.onreadystatechange = function () {
        if (xhrOfflineDictionary.readyState === XMLHttpRequest.DONE &&
                xhrOfflineDictionary.status === 200) {
            dictionary.static.addStrings(JSON.parse(xhrOfflineDictionary.responseText));
        }
    };
    xhrOfflineDictionary.open('GET', chrome.extension.getURL('/dictionary.json'), true);
    xhrOfflineDictionary.send();
    chrome.runtime.onConnect.addListener(function (port) {
        if(port.name === 'insert') {
            var insertion = function (words) {
                if(preserveCase.size >= DICTIONARY_LIMIT) {
                    chrome.runtime.onConnect.removeListener(insertion);
                    return false;
                }
                if(words.length && words.length < DICTIONARY_LIMIT / 100) {
                    dictionary.dynamic.addStrings(words);
                    words.forEach(function (word) {
                        preserveCase.set(word.toLowerCase(), word);
                    });
                }
            };
            port.onMessage.addListener(insertion);
        } else if(port.name === 'query') {
            port.onMessage.addListener(function (prefix) {
                var prefixWords = dictionary.dynamic.keysWithPrefix(prefix);
                if (!prefixWords.length) {
                    prefixWords = dictionary.static.keysWithPrefix(prefix);
                }
                var prefixWordsString = prefixWords.join(' ');
                var prediction = {matchValue: 0, word: null};
                prefixWords = prefixWords.filter(function (word) {
                    return word.toLowerCase() !== prefix &&
                        !prefixWordsString.match(new RegExp('\\b' + word + '[a-z0-9\\.\\-]\\b', 'i'));
                });
                for (var word of prefixWords) {
                    if (natural.JaroWinklerDistance(prefix, word) >= prediction.matchValue) {
                        prediction.matchValue = natural.JaroWinklerDistance(prefix, word);
                        prediction.word = word;
                    }
                    if(prefixWords.indexOf(word) > DICTIONARY_LIMIT / 100) {
                        break;
                    }
                }
                if (prediction.word) {
                    if(preserveCase.get(prediction.word)) {
                        prediction.word = preserveCase.get(prediction.word);
                    }
                    port.postMessage({query: prefix,
                        word: prediction.word.replace(new RegExp('^' + prefix, 'i'), '')});
                }
            });
        }
    });
    chrome.tabs.query({}, function (tabs) {
        tabs.forEach(function (tab) {
            chrome.tabs.reload(tab.id);
        });
    });
}());