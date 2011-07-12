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
		]
   },

   _create: function() {
      this._toolbars = new Toolbars(this.element, this.options, (function(t) { return function() { return t._createUI(); }; })(this) );
      this._editor = new Editor(this.element, this.options);
   },

	// proxy to editor exec function
   exec: function(cmd, args) {
      this._editor.exec(cmd, false, args);
	},

/*
   _getCurrentNode: function() {
      var node,selection;
      if (window.getSelection) { // FF3.6, Safari4, Chrome5 (DOM Standards)
         selection = getSelection();
         node = selection.anchorNode;
      }
      if (!node && document.selection) { // IE
         selection = document.selection;
         var range = selection.getRangeAt ? selection.getRangeAt(0) : selection.createRange();
         node = range.commonAncestorContainer ? range.commonAncestorContainer :
            range.parentElement ? range.parentElement() : range.item(0);
      }
      if (node) {
         return (node.nodeName == "#text" ? node.parentNode : node);
      }
   },
*/

   _createUI: function() {
      return {
      	srcElement: this.element,
      	toolbars: this._toolbars,
         editor: this._editor
      };
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
		this.element.width(this.srcElement.outerWidth()).insertBefore(this.srcElement);
	},
	
	detach: function() {
		this.element.remove();
	}

});

/**
 * Editor object
 */
var Editor = function(element, options) {
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
         .width(this.srcElement.outerWidth());    // width() ?
         
   this.updateHtmlElement();
};

$.extend(Editor.prototype, {
   
   updateSrcElement: function() {
      this.srcElement[this.isDOMelement ? 'html' : 'val'](this.valueFromEditorElement());
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

	   this.srcElement.wrap($('<div></div>').width(this.srcElement.outerWidth() + 2).addClass('ui-richtext-wrapper')).after(this.element).hide();

      this.contentWindow = this.element[0].contentWindow;
      var _doc = this.contentWindow.document;
      _doc.designMode = 'on';
      //this._editor.open();
      //this._editor.write(string);
      //this._editor.close();

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
	   this.contentWindow.document.execCommand(cmd, false, args);
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

	   this.srcElement.wrap($('<div></div>').width(this.srcElement.outerWidth() + 2).addClass('ui-richtext-wrapper')).after(this.element).hide();

      this.element.attr('contenteditable', true)
         .css({'font-family': this.srcElement.css('font-family')});
      this.contentWindow = window;  // global window object
   },

   isActive: function() {
      return this.element.attr('contenteditable');
   },

	setActive: function(b) {
      this.element.focus();
      this.element.attr('contenteditable', !!b);
      if (b) this.element.focus();
	},

   exec: function(cmd, args) {
      this.element.focus();
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
      button: null, // {[type: checkbox|radio|button,] options: {button options}}
                    // TODO : add 'select' special type where options is an hash of value:text of <OPTION> tags
      command: $.noop,
      update: $.noop
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
   }

});

$.ui.richtext.registerTools({
   bold: {
      button: {type:'checkbox', options: {label:'B'}},
      command: function(ui) { ui.editor.exec("bold"); },
      update: function(ui) {  }
   },
   italic: {
      button: {type:'checkbox', options: {label:'I'}},
      command: function(ui) { ui.editor.exec("italic"); },
      update: function(ui) {  }
   },
   underline: {
      button: {type:'checkbox', options: {label:'U'}},
      command: function(ui) { ui.editor.exec("underline"); },
      update: function(ui) {  }
   },
   strikeThrough: {
      button: {type:'checkbox', options: {label:'S'}},
      command: function(ui) { ui.editor.exec("strikethrough"); },
      update: function(ui) {  }
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
      },
      update: function(ui) {  }
   },
})

})(jQuery);
