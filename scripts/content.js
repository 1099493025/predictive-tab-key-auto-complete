/*global chrome, Cursores*/
(function () {
    'use strict';
    var port = {
            insert: chrome.runtime.connect({name: 'insert'}),
            query: chrome.runtime.connect({name: 'query'})
        }, cursores = new Cursores();
    function keyboardAction(event) {
        var node = event.target;
        if(node.selectionEnd && node.selectionStart && node.selectionEnd !== node.selectionStart) {
            if(event.which === 9 || event.which === 13) {
                node.setSelectionRange(node.selectionEnd, node.selectionEnd);
                node.setRangeText(' ');
                node.selectionStart += 1;
                event.preventDefault();
            } else if(event.which === 8 || event.which === 46) {
                node.setRangeText('');
                event.preventDefault();
            }
        }
    }
    function findTextNodes(node) {
        if (!node['predictive-tab-key-auto-complete'] &&
                node.nodeType === 3 &&
                !node.isElementContentWhitespace &&
                node.wholeText.trim().length > 1 &&
                node.parentNode &&
                node.parentNode.matches &&
                !node.parentNode.matches('code, noscript, script, style')) {
            node['predictive-tab-key-auto-complete'] = true;
            port.insert.postMessage(node.wholeText.match(/\b([a-z0-9\.\-]{2,})\b/gim) || []);
        } else if (node.nodeType === 1) {
            Array.prototype.slice.call(node.childNodes).forEach(findTextNodes);
            if (node.matches && node.matches('input[type="text"], textarea')) {
                node.removeEventListener('keydown', keyboardAction);
                node.addEventListener('keydown', keyboardAction);
                node['predictive-tab-key-auto-complete'] = true;
            }
        } 
    }
    var mutationObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            Array.prototype.slice.call(mutation.addedNodes).forEach(findTextNodes);
        });
    });
    mutationObserver.observe(document, {childList: true, subtree: true});
    document.addEventListener('DOMContentLoaded', function () {
        document.body.addEventListener('input', function (event) {
            var node = event.target;
            if (node.matches && node.matches('input[type="text"], textarea')) {
                var prefix = cursores.token(node).value.toLowerCase();
                if (prefix) {
                    port.query.postMessage(prefix);
                    var process = function (prediction) {
                        if (prediction.query === prefix) {
                            node.setRangeText(prediction.word);
                            node.setSelectionRange(node.selectionStart,
                                node.selectionStart + prediction.word.length);
                        }
                        port.query.onMessage.removeListener(process);
                    };
                    port.query.onMessage.addListener(process);
                    setTimeout(function () {
                        port.query.onMessage.removeListener(process);
                    }, 200);
                }
            } else if (node.matches && node.matches('[contenteditable]')) {
                //TBD
            }
        });
        document.body.addEventListener('keydown', function (event) {
            var node = event.target;
            if (node.matches && node.matches('input[type="text"], textarea')) {
                keyboardAction(event);
            }
        });
    });
}());
