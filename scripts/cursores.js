// Copyright 2012 Nicolas Venegas <nvenegas@atlassian.com>
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function (window) {

  /**
   * Cursores allows you to get and replace the token under the cursor
   * in a textarea, text input, or string.
   *
   * By default, the token is whitespace delimited with a search
   * window 128 characters either side of the cursor.
   *
   * leftRegex and rightRegex must each define exactly one capturing
   * group. maxLength must be greater than 0.
   */
  function Cursores(leftRegex, rightRegex, maxLength) {
    this.leftRegex = new RegExp((leftRegex || /(?:^|\s)(\S+)/).source + '$');
    this.rightRegex = new RegExp('^' + (rightRegex || /(\S*)/).source);
    this.maxLength = maxLength > 0 ? maxLength : 128;
  }

  Cursores.VERSION = '0.2';

  /**
   * Returns a new instance that matches a whitespace delimited token
   * starting with the provided character.
   */
  Cursores.startsWith = function (c) {
    return new Cursores(
      new RegExp(['(?:^|\\s)(', c, '[^', c, '\\s]*)'].join(''))
    );
  };

  /**
   * Returns an object representing the token under the cursor.
   *
   * There must be matching text to the left of the cursor to be
   * within a token. For example, in 'f|ox' and 'fox|' (where '|'
   * denotes the cursor), the token value is 'fox', but in '|fox',
   * there is no token under the cursor.
   *
   * If there is no token under the cursor, the "value", "prefix", and
   * "suffix" properties of the result are all the empty string.
   */
  Cursores.prototype.token = function (source, cursorIndex) {
    var text;
    if (typeof source === 'string') {
      // (string, cursorIndex)
      text = source;
    } else {
      // (el)
      text = source.value;
      cursorIndex = source.selectionStart;
    }

    var left = text.slice(0, cursorIndex),
        right = text.slice(cursorIndex),
        searchLeft = left.slice(-this.maxLength),
        searchRight = right.slice(0, this.maxLength);

    var match = searchLeft.match(this.leftRegex),
        prefix = match ? match[1] : '',
        suffix = (match = searchRight.match(this.rightRegex)) ? match[1] : '';

    return {
      value: prefix ? prefix + suffix : '',
      prefix: prefix,
      suffix: prefix ? suffix : '',
      toString: function () { return this.value; }
    };
  };

  /**
   * Replace the token under the cursor with the provided replacement
   * text and, if source is an element, move the cursor to the end of
   * the replacement text within the element.
   *
   * If the source is empty (i.e., it has no contents), even though
   * there is no token under the cursor, the replacement always
   * succeeds.
   *
   * If source is a string, returns the resulting text. If source is
   * an element, returns true if a replacement was made else false.
   */
  Cursores.prototype.replace = function (source, cursorIndex, replacement) {
    var text;
    if (typeof source === 'string') {
      // (string, cursorIndex, replacement)
      text = source;
    } else {
      // (el, replacement)
      text = source.value;
      replacement = cursorIndex;
      cursorIndex = source.selectionStart;
    }

    var token = this.token(text, cursorIndex);
    if (text && !token.value) {
      return typeof source === 'string' ? text : false;
    }

    var left = text.slice(0, cursorIndex),
        right = text.slice(cursorIndex);
    var replacedText = [
      left.slice(0, left.length - token.prefix.length),
      replacement,
      right.slice(token.suffix.length)
    ].join('');

    if (typeof source === 'string') {
      return replacedText;
    } else {
      var delta = replacement.length - token.prefix.length;
      source.value = replacedText;
      source.setSelectionRange(cursorIndex + delta, cursorIndex + delta);
      return true;
    }
  };

  window.Cursores = Cursores;

})(this);
