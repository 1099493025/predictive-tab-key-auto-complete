/*global chrome, Cursores, MutationObserver, Event*/
(function () {
    'use strict';

    const SELECT = {
        TEXT: 'input[type="text"], input[type="search"], textarea',
        CONTENT_EDITABLE: '[contenteditable]',
        IGNORE: 'code, noscript, script, style'
    };

    var port = {
            insert: chrome.runtime.connect({name: 'insert'}),
            query: chrome.runtime.connect({name: 'query'})
        },
        cursores = new Cursores();

    function recursiveTextNodes(node) {
        if (node.nodeType === 3 &&
                !node.isElementContentWhitespace &&
                node.wholeText.trim().length > 1 &&

                node.parentNode &&
                node.parentNode.matches &&
                !node.parentNode.matches(SELECT.IGNORE)) {

            node = node.wholeText.match(/\b(\w+)\b/g);
            if (node) {
                port.insert.postMessage(node);
            }

        } else if (node.nodeType === 1) {
            Array.prototype.slice.call(node.childNodes).forEach(recursiveTextNodes);
        }
    }

    var mutationObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            Array.prototype.slice.call(mutation.addedNodes).forEach(recursiveTextNodes);
        });
    });

    mutationObserver.observe(document, {childList: true, subtree: true});

    document.addEventListener('input', function (event) {
        var node = event.target;

        if (node.matches
                && node.matches(SELECT.TEXT)) {
            var setSelectionText,
                predictUsingString = cursores.token(node).value.toLowerCase();

            if (predictUsingString) {
                port.query.postMessage({prefix: predictUsingString});

            } else {
                predictUsingString = node.value.slice(0, node.selectionStart)
                    .split('').reverse().join('').match(/\W\b(\w+)\b/);

                if (predictUsingString instanceof Array && predictUsingString[1]) {
                    predictUsingString = predictUsingString[1]
                        .split('').reverse().join('');

                    port.query.postMessage({
                        previousWord: predictUsingString
                    });
                }
            }

            setSelectionText = function (prediction) {
                if (predictUsingString === prediction.query) {
                    port.query.onMessage.removeListener(setSelectionText);

                    node.setRangeText(prediction.word);
                    node.setSelectionRange(node.selectionStart,
                            node.selectionStart + prediction.word.length);
                }
            };

            port.query.onMessage.addListener(setSelectionText);

            setTimeout(function () {
                port.query.onMessage.removeListener(setSelectionText);
            }, 200);

        } else if (node.matches && node.matches(SELECT.CONTENT_EDITABLE)) {
            //TBD
            return false;
        }
    });

    document.addEventListener('keydown', function (event) {
        var node = event.target;

        if (node.selectionEnd && node.selectionStart
                && node.selectionEnd !== node.selectionStart) {
            if ((event.which === 9 ||
                    event.which === 13 ||
                    event.which === 39) &&

                    !event.altKey &&
                    !event.ctrlKey &&
                    !event.shiftKey) {

                node.setSelectionRange(node.selectionEnd, node.selectionEnd);
                node.setRangeText(' ');
                node.selectionStart += 1;

                node.dispatchEvent(new Event('input', {
                    bubbles: true
                }));

                event.preventDefault();
            } else if (event.which === 8 || event.which === 46) {
                node.setRangeText('');

                event.preventDefault();
            }
        }
    });
}());