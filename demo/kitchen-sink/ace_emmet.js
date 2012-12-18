define(function(require, exports, module) {
"use strict";
require("./emmet")

var HashHandler = require("ace/keyboard/hash_handler").HashHandler;

// todo: move to ace/document?
var Editor = require("ace/editor").Editor;
Editor.prototype.indexToPosition = function(index) {
    var doc = this.session.doc;
    var lines = doc.$lines || doc.getAllLines();
    var newlineLength = doc.getNewLineCharacter().length;
    for (var i = 0, l = lines.length; i < l; i++) {
        index -= lines[i].length + newlineLength;
        if (index < 0)
            return {row: i, column: index + lines[i].length + newlineLength};
    }
    return {row: l-1, column: lines[l-1].length};
}

Editor.prototype.positionToIndex = function(pos) {
    var doc = this.session.doc;
    var lines = doc.$lines || doc.getAllLines();
    var newlineLength = doc.getNewLineCharacter().length;
    var index = 0;
    var row = Math.min(pos.row, lines.length);
    for (var i=0; i<row; ++i)
        index += lines[i].length;

    return index + newlineLength * i + pos.column;
}

/**
 * Implementation of {@link IEmmetEditor} interface for Ace
 */
function AceEmmetEditor() {}

AceEmmetEditor.prototype = {
    setupContext: function(editor) {
        this.ace = editor;
        this.indentation = editor.session.getTabString();
        emmet.require('resources').setVariable('indentation', this.indentation);
    },
    /**
	 * Returns character indexes of selected text: object with <code>start</code>
	 * and <code>end</code> properties. If there's no selection, should return
	 * object with <code>start</code> and <code>end</code> properties referring
	 * to current caret position
	 * @return {Object}
	 * @example
	 * var selection = editor.getSelectionRange();
	 * alert(selection.start + ', ' + selection.end);
	 */
	getSelectionRange: function() {
        // TODO should start be caret position instead?
        var range = this.ace.getSelectionRange();
		return {
			start: this.ace.positionToIndex(range.start),
			end: this.ace.positionToIndex(range.end)
		};
	},

	/**
	 * Creates selection from <code>start</code> to <code>end</code> character
	 * indexes. If <code>end</code> is ommited, this method should place caret
	 * and <code>start</code> index
	 * @param {Number} start
	 * @param {Number} [end]
	 * @example
	 * editor.createSelection(10, 40);
	 *
	 * //move caret to 15th character
	 * editor.createSelection(15);
	 */
	createSelection: function(start, end) {
        this.ace.selection.setRange({
			start: this.ace.indexToPosition(range.start),
			end: this.ace.indexToPosition(range.end)
		});
    },

	/**
	 * Returns current line's start and end indexes as object with <code>start</code>
	 * and <code>end</code> properties
	 * @return {Object}
	 * @example
	 * var range = editor.getCurrentLineRange();
	 * alert(range.start + ', ' + range.end);
	 */
	getCurrentLineRange: function() {
        var row = this.ace.getCursorPosition().row;
        var lineLength = this.ace.session.getLine(row).length;
        var index = this.ace.positionToIndex({row: row, column: 0});
		return {
			start: index,
			end: index + lineLength
		};
	},

	/**
	 * Returns current caret position
	 * @return {Number|null}
	 */
	getCaretPos: function(){
        var pos = this.ace.getCursorPosition();
        return this.ace.positionToIndex(pos);
    },

	/**
	 * Set new caret position
	 * @param {Number} index Caret position
	 */
	setCaretPos: function(index){
        var pos = this.ace.indexToPosition(index);
        this.ace.clearSelection();
        this.ace.selection.moveCursorToPosition(pos);
    },

	/**
	 * Returns content of current line
	 * @return {String}
	 */
	getCurrentLine: function() {
        var row = this.ace.getCursorPosition().row;
        return this.ace.session.getLine(row);
    },

	/**
	 * Replace editor's content or it's part (from <code>start</code> to
	 * <code>end</code> index). If <code>value</code> contains
	 * <code>caret_placeholder</code>, the editor will put caret into
	 * this position. If you skip <code>start</code> and <code>end</code>
	 * arguments, the whole target's content will be replaced with
	 * <code>value</code>.
	 *
	 * If you pass <code>start</code> argument only,
	 * the <code>value</code> will be placed at <code>start</code> string
	 * index of current content.
	 *
	 * If you pass <code>start</code> and <code>end</code> arguments,
	 * the corresponding substring of current target's content will be
	 * replaced with <code>value</code>.
	 * @param {String} value Content you want to paste
	 * @param {Number} [start] Start index of editor's content
	 * @param {Number} [end] End index of editor's content
	 * @param {Boolean} [noIndent] Do not auto indent <code>value</code>
	 */
	replaceContent: function(value, start, end, noIndent) {
        if (end == null)
            end = start == null ? content.length : start;
        if (start == null)
            start = 0;
        var utils = emmet.require('utils');

        // indent new value
        if (!noIndent) {
            value = utils.padString(value, utils.getLinePaddingFromPosition(this.getContent(), start));
        }

        // find new caret position
        var tabstopData = emmet.require('tabStops').extract(value, {
            escape: function(ch) {
                return ch;
            }
        });
        console.log(value)
        value = tabstopData.text;
        var firstTabStop = tabstopData.tabstops[0];

        if (firstTabStop) {
            firstTabStop.start += start;
            firstTabStop.end += start;
        } else {
            firstTabStop = {
                start: value.length + start,
                end: value.length + start
            };
        }

        var range = this.ace.getSelectionRange();
        range.start = this.ace.indexToPosition(start);
        range.end = this.ace.indexToPosition(end);

        this.ace.session.replace(range, value);

        range.start = this.ace.indexToPosition(firstTabStop.start);
        range.end = this.ace.indexToPosition(firstTabStop.end);
        this.ace.selection.setRange(range);
    },

	/**
	 * Returns editor's content
	 * @return {String}
	 */
	getContent: function(){
        return this.ace.getValue();
    },

	/**
	 * Returns current editor's syntax mode
	 * @return {String}
	 */
    getSyntax: function() {
        var syntax = this.ace.session.$modeId.split("/").pop();
        if (!emmet.require('resources').hasSyntax(syntax))
            syntax = 'html';

        if (syntax == 'html') {
            var cursor = this.ace.getCursorPosition();
            var state = this.ace.session.getState(cursor.row);
            if (state) {
                state = state.split("-");
                if (state.length > 1)
                    syntax = state[0];
            }
        }
        return syntax;
    },

	/**
	 * Returns current output profile name (@see emmet#setupProfile)
	 * @return {String}
	 */
	getProfileName: function() {
        switch(this.getSyntax()) {
          case 'xml':
          case 'xsl':
            return 'xml';
          case 'html':
            var profile = emmet.require('resources').getVariable('profile');
            // no forced profile, guess from content html or xhtml?
            if (!profile)
                profile = this.getContent().search(/<!DOCTYPE[^>]+XHTML/i) != -1 ? 'xhtml': 'html';
            return profile;
        }
        return 'xhtml';
    },

	/**
	 * Ask user to enter something
	 * @param {String} title Dialog title
	 * @return {String} Entered data
	 * @since 0.65
	 */
	prompt: function(title) {
		return prompt(title);
	},

	/**
	 * Returns current selection
	 * @return {String}
	 * @since 0.65
	 */
	getSelection: function() {
		return this.ace.session.getTextRange();
	},

	/**
	 * Returns current editor's file path
	 * @return {String}
	 * @since 0.65
	 */
	getFilePath: function() {
		return '';
	}
};


var keymap = {
    'Cmd-E': 'expand_abbreviation',
    'Tab': 'expand_abbreviation_with_tab',
    'Cmd-D': 'match_pair_outward',
    'Cmd-T': 'matching_pair',
    'Shift-Cmd-D': 'match_pair_inward',
    'Shift-Cmd-A': 'wrap_with_abbreviation',
    'Ctrl-Alt-Right': 'next_edit_point',
    'Ctrl-Alt-Left': 'prev_edit_point',
    'Cmd-L': 'select_line',
    'Cmd-Shift-M': 'merge_lines',
    'Cmd-/': 'toggle_comment',
    'Cmd-J': 'split_join_tag',
    'Cmd-K': 'remove_tag',
    'Shift-Cmd-Y': 'evaluate_math_expression',

    'Ctrl-Up': 'increment_number_by_1',
    'Ctrl-Down': 'decrement_number_by_1',
    'Alt-Up': 'increment_number_by_01',
    'Alt-Down': 'decrement_number_by_01',
    'Ctrl-Alt-Up': 'increment_number_by_10',
    'Ctrl-Alt-Down': 'decrement_number_by_10',

    'Cmd-.': 'select_next_item',
    'Cmd-,': 'select_previous_item',
    'Cmd-B': 'reflect_css_value',

    'Enter': 'insert_formatted_line_break'
};
var editorProxy = new AceEmmetEditor();
exports.commands = new HashHandler();
function runEmmetCommand(name, editor) {
    editorProxy.setupContext(editor);
    emmet.require('actions').run(name, editorProxy);
}

for (var i in keymap) {
    var n = keymap[i]
    exports.commands.addCommand({
        name: n,
        bindKey: {mac: i, win: i.replace("Cmd", "Ctrl")},
        exec: runEmmetCommand.bind(null, n)
    })
}


exports.AceEmmetEditor = AceEmmetEditor
exports.initEmmet = function(editor) {
    var onChangeMode = function(e) {
        var modeId = editor.session.$modeId;
        if (modeId && /css|html|js/.test(modeId)) {
            editor.keyBinding.addKeyboardHandler(exports.commands);
        } else
            editor.keyBinding.addKeyboardHandler(exports.commands);
    }
    editor.on("changeMode", onChangeMode);
    onChangeMode()
}
});

