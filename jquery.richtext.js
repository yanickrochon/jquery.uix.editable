/**
 * JQuery UI RichText Widget
 *
 *   This a demo implementation of a richtext editor using the JQuery UI Widget factory
 *   recommendations and keeping it simple. The editor is fully extensible and should
 *   degrade gracefully if the browser does not support it.
 *
 *
 * @author Yanick Rochon (yanic.rochon@gmail.com)
 * @version 0.5
 */

(function($) {

$.widget("ui.richtext", {
	// default options
	options: {
		sandboxed: true,    // use an iframe? (true -- default) or not? (false)
		editorStyles: [],    // ignored if sandboxed = false
		toolbars: [
			"bold,italic,underline,strikeThrough",
			"viewSource"
		],
		enter: function() { }
	},

	_create: function() {
		var _createUI = (function(t) { return function(obj) { return t._createUI(obj); }; })(this);
		this._toolbars = new Toolbars(this.element, this.options, _createUI);
		this._editor = new Editor(this.element, this.options, _createUI);
	},

	// proxy to editor exec function
	exec: function(cmd, args) {
		this._editor.exec(cmd, false, args);
	},

	_createUI: function(obj) {
		return $.extend(obj || {}, {
			srcElement: this.element,
			toolbars: this._toolbars,
		   editor: this._editor
		});
	},

	enable: function() {
		$.Widget.prototype.enable.apply(this, arguments);
		this._editor.setActive(true);
	},
	disable: function() {
		$.Widget.prototype.disable.apply(this, arguments);
		this._editor.setActive(false);
	},
	tools: function(tool) {
		if ($.ui.richtext.Tools[tool]) {
			var args = Array.prototype.slice.call(arguments);
			args.shift();

		   $.ui.richtext.Tools[tool].command(this._createUI(), args);
		}
	},

	destroy: function() {
		$.Widget.prototype.destroy.apply(this, arguments); // default destroy
		// now do other stuff particular to this widget
		this._toolbars.detach();
		this._toolbars = null;
		this._editor.dispose();
		this._editor = null;
		this.element.unwrap().show();
	}
});


/**
 * Toolbars object
 */
var Toolbars = function(element, options, uiFn) {
	this.srcElement = element;
	this.options = options;
	this._createUI = uiFn;
	this.init();
	
	var that = this;
	
	this.srcElement.bind('richtextcaretmoved', function(e, ui) {
		var tools = $.ui.richtext.Tools;
		$.each(that.watchableTools, function(i,t) {
			tools[t].update(ui);
		});
	});
	
};

var button_id_prefix = 'btnToolRTE_';
var button_id = 0;  // button auto-generated ids

$.extend(Toolbars.prototype, {

	init: function() {
		this.element = $('<div></div>').addClass('ui-richtext-toolbar');
		
		if (this.options.toolbars && this.options.toolbars.length) {
			this.attach();
			this.update();
		}
	},
	
	update: function() {
		this.element.empty();
		
		var toolbar = $('<div></div>').addClass('ui-widget ui-widget-header ui-corner-top').css('padding','2px');
		var tools = $.ui.richtext.Tools;
		var _createUI = this._createUI;
		var _watchableTools = this.watchableTools = [];
	
		$.each(this.options.toolbars, function(i,e) {
			var _buttonset = $('<span></span>'), btnCount = 0;
			$.each(e.split(','), function(i,t) {
				if (tools[t]) {
					var button = tools[t].button;
					var id = button_id_prefix + (button_id++);
					var btn;
					switch (button.type) {
						case 'button':
							btn = $('<button id="'+id+'"></button>').click(function() { tools[t].command(_createUI()); });
							_buttonset.append(btn);
							break;
						case 'checkbox':
							btn = $('<input id="'+id+'" type="checkbox" />').click(function() { tools[t].command(_createUI(), [$(this).attr('checked')]); });
							_buttonset.append(btn).append($('<label for="'+id+'"></label>'));
							break;
					}
					btn.button(button.options);
					
					if (tools[t].update) {
						var _u = tools[t].update;
						tools[t].update = function(ui) {
							ui.button = btn;
							_u(ui);
						};
						_watchableTools.push(t);
					}
					btnCount++;
				}
			});
			if (btnCount) _buttonset.appendTo(toolbar).buttonset();
		});
		
		this.element.append(toolbar);
	},

	hide: function() {
		this.element.hide();
	},
	
	show: function() {
		this.element.show();
	},
	
	attach: function() {
		this.element.width('100%' /*this.srcElement.outerWidth()*/).insertBefore(this.srcElement);
	},
	
	detach: function() {
		this.element.remove();
	}

});

/**
 * Editor object
 */
var Editor = function(element, options, uiFn) {
	// determine whether we use .val() or .html() to get the value on this.element
	this.isDOMelement = (-1 == "textarea".indexOf(element[0].tagName.toLowerCase()));
	this.srcElement = element;
	this.options = options;

	// add specialized functions
 	$.extend(this, this.options.sandboxed ? IFrameEditor : ElementEditor);

	this.init();

	this.element
			.addClass('ui-widget ui-widget-content')
			.height(this.srcElement.outerHeight())   // height() ?
			.width('100%') /*.width(this.srcElement.outerWidth())*/;    // width() ?

	var that = this;
	var ranges = null;

	// This hack is mainly for IE9, which loses the current selection on change of focus
	// (may only happen when editor is in iframe), so using the toolbar would reset the 
	// position before applying the command.
	if (window.getSelection) {
	    // IE 9 and non-IE
	    that.saveSelection = function(win) {
	        var sel = win.getSelection();//, 
	        ranges = [];
	        if (sel.rangeCount) {
	            for (var i = 0, len = sel.rangeCount; i < len; ++i) {
	                ranges.push(sel.getRangeAt(i));
	            }
	        }
	        return ranges;
	    };

	    that.restoreSelection = function(win) {
	        var sel = win.getSelection();
	        sel.removeAllRanges();
	        for (var i = 0, len = ranges.length; i < len; ++i) {
	            sel.addRange(ranges[i]);
	        }
	    };
	} else if (document.selection && document.selection.createRange) {
	    // IE <= 8
	    that.saveSelection = function(win) {
	        var sel = win.document.selection;
	        ranges = (sel.type != "None") ? sel.createRange() : null;
	    };

	    that.restoreSelection = function(win) {
	        if (ranges) {
	            ranges.select();
	        }
	    };
	}

	$(this.contentWindow).bind('keydown', function(event) {
		if (event.which == 13 && !event.shiftKey) {
			return that.options.enter();
		}
	});
	
	$(this.contentWindow).bind('keyup mouseup', function() {
		element.trigger('richtextcaretmoved', uiFn({caretPosition:that.getCursorPosition(), currentNode:$(that.getNodeAtCursor())}));
		// FIXME: Is there a better event we can catch (e.g. blur)?
		that.saveSelection(that.contentWindow);
	});
 
 	// FIXME IE hack... document.body for iframe is still null
 	setTimeout(function() {        
		that.updateHtmlElement();
	}, 250);
};

$.extend(Editor.prototype, {

	updateSrcElement: function() {
		this.srcElement[this.isDOMelement ? 'html' : 'val'](this.valueFromEditorElement());
	},

	/**
	 * @return int
	 */
	getCursorPosition: function() {
		var cursorPos;
		var win = this.contentWindow;
		if (win.getSelection) {
			var selObj = win.getSelection();
			var selRange = selObj.getRangeAt(0);
			cursorPos =  (function(list,node) {
				for (var i = 0; i < list.length; i++) {
					if (list[i] == node) {
						return i;
					}
				}
				return -1;
			})(selObj.anchorNode.parentNode.childNodes, selObj.anchorNode) + selObj.anchorOffset;
			/* FIXME the following works wrong in Opera when the document is longer than 32767 chars */
		} else if (win.document.selection) {
			var range = win.document.selection.createRange();
			var bookmark = range.getBookmark();
			/* FIXME the following works wrong when the document is longer than 65535 chars */
			cursorPos = bookmark.charCodeAt(2) - 11; /* Undocumented function [3] */
		}
		return cursorPos;
	},

   getNodeAtCursor: function() {
      var node,selection;
      var win = this.contentWindow;
      if (win.getSelection) { // FF3.6, Safari4, Chrome5 (DOM Standards)
         selection = win.getSelection();
         node = selection.anchorNode;
      }
      if (!node && win.document.selection) { // IE
         selection = win.document.selection;
         var range = selection.getRangeAt ? selection.getRangeAt(0) : selection.createRange();
         node = range.commonAncestorContainer ? range.commonAncestorContainer :
            range.parentElement ? range.parentElement() : range.item(0);
      }
      if (node) {
         return (node.nodeName == "#text" ? node.parentNode : node);
      } else {
      	alert("Your browser does not support this feature");
      }
   },

	/**
	 * @param node       a DOMElement
	 */
	insertNodeAtCursor: function(node) {
		var range, html;
		var win = this.contentWindow;
		if (win.getSelection && win.getSelection().getRangeAt) {
			range = win.getSelection().getRangeAt(0);
			range.insertNode(node);
		} else if (win.document.selection && win.document.selection.createRange) {
			range = win.document.selection.createRange();
			html = (node.nodeType == 3) ? node.data : node.outerHTML;
			range.pasteHTML(html);
		} else {
			alert("Your browser does not support this feature");
		}
	},
	
	insertHtmlAtCursor: function(html) {
		var range, node;
		var win = this.contentWindow;
		if (win.getSelection && win.getSelection().getRangeAt) {
			range = win.getSelection().getRangeAt(0);
			node = range.createContextualFragment(html);
			range.insertNode(node);
		} else if (win.document.selection && win.document.selection.createRange) {
			win.document.selection.createRange().pasteHTML(html);
		} else {
			alert("Your browser does not support this feature");
		}
	},
	
	/**
	 * Return the value from the source element (textarea or DOMElement)
	 */
	valueFromSrcElement: function() {
		return this.srcElement[this.isDOMelement ? 'html' : 'val']();
	},

	dispose: function() {
		this.updateSrcElement();
		this.element.remove();
		delete this.element;
	}

});

/**
 * Sand boxed editor (use an iframe)
 */
var IFrameEditor = {

	init: function() {
		this.element = $("<iframe/>");

		this.srcElement.wrap($('<div></div>').width('100%' /*this.srcElement.outerWidth() + 2*/).addClass('ui-richtext-wrapper')).after(this.element).hide();

		this.contentWindow = this.element[0].contentWindow;
		var _doc = this.contentWindow.document;
		_doc.designMode = 'on';
		//this._editor.open();
		//this._editor.write(string);
		//this._editor.close();

		var contentWindow = $(".ui-richtext-wrapper iframe")[0].contentWindow;
		contentWindow.onload = function() {
			contentWindow.document.designMode = "on";
			if (!$.browser.msie) {
				contentWindow.document.execCommand("useCSS", false, true);
			}
		}

		if (this.options.editorStyles) {
			$.each(this.options.editorStyles, function(i,e) {
				$('head', _doc).append(
					$('<link/>')
						.attr('rel', 'stylesheet')
						.attr('type', 'text/css')
						.attr('href', e)
				);
			});
		}
	},

	isActive: function() {
		return this.contentWindow.document.designMode == 'on';
	},

	setActive: function(b) {
		this.contentWindow.document.designMode = (b ? 'on' : 'off');
		if (b) this.element.focus();
	},

    exec: function(cmd, args) {
		this.contentWindow.focus();
		this.restoreSelection(this.contentWindow);
		if (cmd != 'none')
			this.contentWindow.document.execCommand(cmd, false, args);
		if (cmd == "selectAll")
			this.saveSelection(this.contentWindow);			
		this.updateSrcElement();
	},

	updateHtmlElement: function() {
		this.contentWindow.document.body.innerHTML = this.valueFromSrcElement();
	},

	/**
	 * Return the value from the RTE area
	 */
	valueFromEditorElement: function() {
		return this.contentWindow.document.body.innerHTML;
	},

	value: function(html) {
		var _doc = this.contentWindow.document;
		if (html) {
		   _doc.body.innerHTML = html;
		} else {
		   return _doc.body.innerHTML;
		}
		// if we have set something, we did not return yet, so update source element
		this.updateSrcElement();
	}

};

/**
 * Inline editor (use a DOMElement)
 */
var ElementEditor = {

	init: function() {
		this.element = $("<div/>");

		this.srcElement.wrap($('<div></div>').width('100%' /*this.srcElement.outerWidth() + 2*/).addClass('ui-richtext-wrapper')).after(this.element).hide();

		this.element.attr('contentEditable', true)
			.css({'font-family': this.srcElement.css('font-family')});
		this.contentWindow = window;  // global window object
	},

	isActive: function() {
		return this.element.attr('contentEditable');
	},

	setActive: function(b) {
		this.element.focus();
		this.element.attr('contentEditable', !!b);
		if (b) this.element.focus();
	},

	exec: function(cmd, args) {
		this.element.focus();
		if (cmd != 'none')
			this.contentWindow.document.execCommand(cmd, false, args);
		this.updateSrcElement();
	},

	updateHtmlElement: function() {
		this.element.html(this.valueFromSrcElement());
	},

	/**
	 * Return the value from the RTE area
	 */
	valueFromEditorElement: function() {
		return this.element.html();
	},

	value: function(html) {
		if (html) {
			this.element.html(html);
		} else {
			return this.element.html();
		}
		// if we have set something, we did not return yet, so update source element
		this.updateSrcElement();
	}

};



// any plugin may extend $.ui.richtext.Tools to add more tools, or override some
// the context of the function is the actual ui.richtext instance will all private
// functions and attributes visible.
$.extend(true, $.ui.richtext, {
	/**
	 * all functions receives two arguments: ui, args
	 *   ui.richtext    the actual widget object with all private methods exposed
	 *   ui.button      the tool button
	 *
	 */
	BaseTool: {
		button: null,	// {[type: checkbox|radio|button,] options: {button options}}
							// TODO : add 'select' special type where options is an hash of value:text of <OPTION> tags
		command: $.noop
		//update: $.noop   // optional method, ONLY implment the function if tools needs updates on editor changes
		                   // signature = function(ui) where ui.currentNode is the node at caret position and
		                   //                                ui.caretPosition is the caret position
		                 
	},

	// return an array of all available tools
	getAllTools: function() {
		var tools = [];
		$.each($.ui.richtext.Tools, function(tool, fn) { tools.push(tool); });
		return tools;
	},

	Tools: {},

	// expects an object as first argument
	registerTools: function(tools) {
		var rt = $.ui.richtext.Tools;
		$.each(tools, function(tool,option) {
		   rt[tool] = $.extend({}, rt.BaseTool, option);
		});
	},
	
	/**
	 * Lookup the given node and node's parents for the given style value. Returns boolean
	 *
	 * @param e     element (jQuery object)
	 * @param style the style name
	 * @param value the value to look for
	 * @return boolean
	 */  
	cssLookup: function(e, style, value) {
		var result = (e.css(style) == value);
		if (!result) {
			e.parents().each(function() {
				if ($(this).css(style) == value) {
					result = true;
					return false;
				}
			});
		}

		return result;
	}

});

$.ui.richtext.registerTools({
	bold: {
		button: {type:'checkbox', options: {label:'B'}},
		command: function(ui) { ui.editor.exec("bold"); },
		update: function(ui) {
			var fontWeight = ui.currentNode.css('font-weight');
			if (fontWeight == 'bold' || parseInt(fontWeight) > 500) {
				ui.button.attr('checked', true).button('refresh');
			} else {
				ui.button.removeAttr('checked').button('refresh');
			}
		}
	},
	italic: {
		button: {type:'checkbox', options: {label:'I'}},
		command: function(ui) { ui.editor.exec("italic"); },
		update: function(ui) {  
			if (ui.currentNode.css('font-style') == 'italic') {
				ui.button.attr('checked', true).button('refresh');			
			} else {
				ui.button.removeAttr('checked').button('refresh');			
			}
		}
	},
	underline: {
		button: {type:'checkbox', options: {label:'U'}},
		command: function(ui) { ui.editor.exec("underline"); },
		update: function(ui) {  
			if ($.ui.richtext.cssLookup(ui.currentNode, 'text-decoration', 'underline')) {
				ui.button.attr('checked', true).button('refresh');			
			} else {
				ui.button.removeAttr('checked').button('refresh');			
			}
		}
	},
	strikeThrough: {
		button: {type:'checkbox', options: {label:'S'}},
		command: function(ui) { ui.editor.exec("strikethrough"); },
		update: function(ui) {  
			if ($.ui.richtext.cssLookup(ui.currentNode, 'text-decoration', 'line-through')) {
				ui.button.attr('checked', true).button('refresh');			
			} else {
				ui.button.removeAttr('checked').button('refresh');			
			}	
		}
	},
	viewSource: {
		button: {type:'checkbox', options: {label:'Source'}},
		command: function(ui, args) {
			if (args.length && args[0]) {
				ui.toolbars.hide();
				ui.editor.element.hide();
				ui.srcElement.show();
			} else {
				ui.editor.updateHtmlElement();
				ui.srcElement.hide();
				ui.editor.element.show();
				ui.toolbars.show();
			}
		}
	}
})

})(jQuery);
