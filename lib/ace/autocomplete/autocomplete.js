/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2012, Ajax.org B.V.
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

define(function(require, exports, module) {
"use strict";

var Autocomplete = function(editor) {
    this._self = this;
    this.$editor = editor;

    var originalOnTextInput = this.$editor.onTextInput;
    var originalSoftTabs = this.$editor.session.getUseSoftTabs();
    
    // Create the suggest list
    this.autocompleteElement = document.createElement('ul');
    this.autocompleteElement.className = 'ace_autocomplete';
    this.autocompleteElement.style.display = 'none';
    this.autocompleteElement.style.listStyleType = 'none';
    this.autocompleteElement.style.padding = '2px';
    this.autocompleteElement.style.position = 'fixed';
    this.autocompleteElement.style.zIndex = '1000';
    this.$editor.container.appendChild(this.autocompleteElement);
};

(function() {
    var _self = this;
    function current(_self) {
      var children = _self.autocompleteElement.childNodes;
      for (var i = 0; i < children.length; i++) {
        var li = children[i];
        if(li.className == 'ace_autocomplete_selected') {
          return li;
        }
      };
    }

    function focusNext() {
      var curr = current(_self);
      curr.className = '';
      var focus = curr.nextSibling || curr.parentNode.firstChild;
      focus.className = 'ace_autocomplete_selected';
    }

    function focusPrev() {
      var curr = current(_self);
      curr.className = '';
      var focus = curr.previousSibling || curr.parentNode.lastChild;
      focus.className = 'ace_autocomplete_selected';
    }

    function ensureFocus(_self) {
      if(!current(_self)) {
        _self.autocompleteElement.firstChild.className = 'ace_autocomplete_selected';
      }
    }

    function replace() {
      var Range = require('ace/range').Range;
      var range = new Range(self.row, self.column, self.row, self.column + 1000);
      // Firefox does not support innerText property, don't know about IE
      // http://blog.coderlab.us/2005/09/22/using-the-innertext-property-with-firefox/
      var selectedValue;
      if(document.all){
        selectedValue = current().innerText;
      } else{
        selectedValue = current().textContent;
      }

      this.$editor.session.replace(range, selectedValue);
      // Deactivate asynchrounously, so that in case of ENTER - we don't reactivate immediately.
      setTimeout(function() {
        deactivate();
      }, 0);
    }

    function deactivate() {
      // Hide list
      this.autocompleteElement.style.display = 'none';
      
      // Restore keyboard
      this.$editor.session.setUseSoftTabs(originalSoftTabs);
      this.$editor.onTextInput = originalOnTextInput;

      self.active = false;
    }
    
    function getHint(editor) {
        var cursor = editor.getCursorPosition(), token = editor.session.getTokenAt(cursor.row, cursor.column - 1), tprop = token;
        // If it's not a 'word-style' token, ignore the token.
        if (!/^[\w$_]*$/.test(token.value)) {
            token = tprop = {start: cur.ch, end: cur.ch, string: "", state: token.state,
                             type: token.string == "." ? "property" : null};
        }
        
        // If it is a property, find out what it is a property of.
        //while (tprop.type == "property") {
         /* tprop = getToken(editor, {line: cur.line, ch: tprop.start});
          if (tprop.string != ".") return;
          tprop = getToken(editor, {line: cur.line, ch: tprop.start});
          if (tprop.string == ')') {
            var level = 1;
            do {
              tprop = getToken(editor, {line: cur.line, ch: tprop.start});
              switch (tprop.string) {
              case ')': level++; break;
              case '(': level--; break;
              default: break;
              }
            } while (level > 0);
            tprop = getToken(editor, {line: cur.line, ch: tprop.start});
        if (tprop.type == 'variable')
          tprop.type = 'function';
        else return; // no clue
          }
          if (!context) var context = [];
          context.push(tprop);
        }*/
        return {list: getCompletions(token, context, keywords, options),
                from: {line: cur.line, ch: token.start},
                to: {line: cur.line, ch: token.end}};
      }
    };

    function getCompletions(token) {
    var found = [], start = token.string;
    function maybeAdd(str) {
      if (str.indexOf(start) == 0 && !arrayContains(found, str)) found.push(str);
    }
    function gatherCompletions(obj) {
      if (typeof obj == "string") forEach(stringProps, maybeAdd);
      else if (obj instanceof Array) forEach(arrayProps, maybeAdd);
      else if (obj instanceof Function) forEach(funcProps, maybeAdd);
      for (var name in obj) maybeAdd(name);
    }

    if (context) {
      // If this is a property, see if it belongs to some object we can
      // find in the current environment.
      var obj = context.pop(), base;
      if (obj.type == "variable") {
        if (options && options.additionalContext)
          base = options.additionalContext[obj.string];
        base = base || window[obj.string];
      } else if (obj.type == "string") {
        base = "";
      } else if (obj.type == "atom") {
        base = 1;
      } else if (obj.type == "function") {
        if (window.jQuery != null && (obj.string == '$' || obj.string == 'jQuery') &&
            (typeof window.jQuery == 'function'))
          base = window.jQuery();
        else if (window._ != null && (obj.string == '_') && (typeof window._ == 'function'))
          base = window._();
      }
      while (base != null && context.length)
        base = base[context.pop().string];
      if (base != null) gatherCompletions(base);
    }
    else {
      // If not, just look in the window object and any local scope
      // (reading into JS mode internals to get at the local variables)
      for (var v = token.state.localVars; v; v = v.next) maybeAdd(v.name);
      gatherCompletions(window);
      forEach(keywords, maybeAdd);
    }
    return found;
  }   
    // Shows the list and reassigns keys
    this.activate = function(row, column) {
      if(this.active) return;
      this.active = true;
      
      var results = getHint(this.$editor);

      // Position the list
      var coords = this.$editor.renderer.textToScreenCoordinates(row, column);
      this.autocompleteElement.style.top = coords.pageY + 2 + 'px';
      this.autocompleteElement.style.left = coords.pageX + -2 + 'px';
      this.autocompleteElement.style.display = 'block';

      // Take over the keyboard

      this.active = false;
    };
    
    // Sets the text the suggest should be based on.
    // afterText indicates the position where the suggest box should start.
    this.suggest = function(text) {
      var options = ["bleh", "fleh"];
      if(options.length == 0) {
        return deactivate();
      }
      var html = '';
      for(var n in options) {
        html += '<li>' + options[n] + '</li>';
      }
      this.autocompleteElement.innerHTML = html;
      ensureFocus(this._self);
    }
}).call(Autocomplete.prototype);

exports.Autocomplete = Autocomplete;

});