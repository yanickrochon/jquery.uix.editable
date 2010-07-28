/**
 * JQuery UI RichText Widget
 *
 *   This a demo implementation of a richtext editor using the JQuery UI Widget factory
 *   recommendations and keeping it simple. The editor is fully extensible and should
 *   degrade gracefully if the browser does not support it.
 *
 *
 * @author Yanick Rochon (yanic.rochon@gmail.com)
 * @version 0.4
 */

(function($) {

$.widget("ui.richtext", {
   // default options
   options: {
      sandboxed: false,    // use an iframe? (true) or not? (false)
      editorStyles: [],    // ignored if sandboxed = false
      toolbars: [
		   {location:'top',name:'default',buttons:"bold,italic,underline,strikeThrough"},
		   {location:'top',name:'status',align:'right',buttons:"viewSource"}
		]      // false = no toolbar, [{...}] = toolbar specs array 
   },

   _create: function() {
      // determine whether we use .val() or .html() to get the value on this.element
      this.isDOMelement = (-1 == "textarea".indexOf(this.element[0].tagName.toLowerCase()));

      this._initEditor();
      this._initToolbars();

      // TODO : auto-update textarea (or this.element) with HTML content on change
      //        bind keyup,keydown,mousedown,blur
      // TODO : apply fixes for different browser implementation

   },

   _initEditor: function() {
      this.elementHtml = $(this.options.sandboxed ? "<iframe/>" : "<div/>")
         .addClass('ui-widget ui-widget-content')
         .height(this.element.outerHeight())   // height() ?
         .width(this.element.outerWidth());    // width() ?

      this.element.wrap($('<div></div>').width(this.element.outerWidth() + 2).addClass('ui-richtext-wrapper')).after(this.elementHtml).hide();

      if (this.options.sandboxed) {
         var editor = this._editor = this.elementHtml[0].contentWindow.document;
         this._editor.designMode = 'on';
         this._editor.open();
         this._editor.write(this._valueFromElement());
         this._editor.close();

         if (this.options.editorStyles) {
            $.each(this.options.editorStyles, function(i,e) {
               $('head', editor).append(
                  $('<link/>')
                     .attr('rel', 'stylesheet')
                     .attr('type', 'text/css')
                     .attr('href', e)
               );
            });
         }

      } else {
	      this.elementHtml.attr('contenteditable', true)
	         .css({'font-family': this.element.css('font-family')})
	         .html(this._valueFromElement());
	      this._editor = window.document;
      }
   },
   
   _initToolbars: function() {
      if (!this.options.toolbars) {
         return;
      }
      
      var that = this;
      var toolbars = $.each({
         right:{insertion:'prepend'},
         left:{insertion:'prepend'},
         top:{insertion:'prepend'},
         bottom:{insertion:'append'}
      }, function(l,tbo) {
         $.extend(tbo,{
            buttonCount: 0,
            element: null,
         })
      });
      var availableTools = $.ui.richtext.Tools;
      var lastButtonset = null;
      var flushButtonset = function() {
         $(lastButtonset).buttonset();
         lastButtonset = null;
      };
      
      $.each(this.options.toolbars, function(i,toolbarSpecs) {
         var tbElement;
         var tbLoc = toolbarSpecs.location || 'top';
         var tbButtons = toolbarSpecs.buttons.split(',');
         
         if (toolbars[tbLoc]) {
            if (!toolbars[tbLoc].element) {
               toolbars[tbLoc].element = $('<div></div>')
                  .addClass('ui-widget ui-widget-header ui-richtext-toolbar ui-richtext-toolbar-' + tbLoc.replace(/[^a-zA-Z0-9_-]/, ''))
               ;
            }
            toolbars[tbLoc].buttonCount++;
         } else {
            toolbars[tbLoc] = {
               buttonCount: 1,
               insertion: null,
               element: $(tbLoc)
            };
         }
         tbElement = toolbars[tbLoc].element;
         if (toolbarSpecs.align) {
            tbElement.css('textAlign', toolbarSpecs.align);
         }
         
         $.each(tbButtons, function(i,toolName) {
            if ('|' == toolName) {
               flushButtonset();
            } else {
               var toolBtnDef = availableTools[toolName].button;
               var id = 'btn' + toolName + (new Date().getTime());
               if (!lastButtonset) {
                  lastButtonset = $('<span></span>');
                  tbElement.append(lastButtonset);
               }

               var btn, requireLabel = false;
               switch (toolBtnDef.type || 'button') {
                  case 'checkbox':
                  case 'radio':
                     btn = $('<input type="' + toolBtnDef.type + '"></input>');
                     requireLabel = true;
                     break;
                  case 'link':
                     btn = $('<a href="#"></a>');
                     break;
                  case 'button':
                  default:
                     btn = $('<button></button>');
               }
               
               lastButtonset.append(btn);
               if (requireLabel) {
                  btn.attr('id', id);
                  lastButtonset.append($('<label for="' + id + '"></label>'));
               }
               
               btn.button(availableTools[toolName].button.options)
                  .click(function() {
                     availableTools[toolName].command(that._createUI(), [requireLabel ? btn.attr('checked') : btn.val()]);
                  })
               ;
               
               if (!toolbarSpecs.buttons) {
                  toolbarSpecs.buttons = {};
               }
               toolbarSpecs.buttons[toolName] = btn;
            }
         });
         flushButtonset();
      });
      
      var container = this.element.parent();  // wrapped container
      $.each(toolbars, function(loc,toolbarSpecs) {
         if (toolbarSpecs.buttonCount) {
            if (null != toolbarSpecs.insertion) {
               container[toolbarSpecs.insertion](toolbarSpecs.element);
            }
         } else {
            toolbarSpecs.element = null;
         }
      });
   },

   _exec: function(cmd, args) {
      if (this.options.sandboxed) {
         this.elementHtml[0].contentWindow.focus();
      } else {
         this.elementHtml.focus();
      }
      this._editor.execCommand(cmd, false, args);
      this._updateElement();
	},

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

   _updateElement: function() {
      this.element[this.isDOMelement ? 'html' : 'val'](this._valueFromHtmlArea());
   },

   _updateHtmlArea: function() {
      if (this.options.sandboxed) {
         this._editor.body.innerHTML = this._valueFromElement();
      } else {
         this.elementHtml.html(this._valueFromElement());
      }
    },

   _valueFromElement: function() {
      return this.element[this.isDOMelement ? 'html' : 'val']();
   },

   _valueFromHtmlArea: function() {
      if (this.options.sandboxed) {
         return this._editor.body.innerHTML;
      } else {
         return this.elementHtml.html();
      }
   },
   
   _createUI: function() {
      return {
         richtext: this
      };
   },

   enable: function() {
      $.Widget.prototype.enable.apply(this, arguments);
      if (this.options.sandboxed) {
         this._editor.designMode = 'on';
      } else {
         this.elementHtml.attr('contenteditable', true);
         this.elementHtml.focus();
      }
   },
   disable: function() {
      $.Widget.prototype.disable.apply(this, arguments);
      if (this.options.sandboxed) {
         this._editor.designMode = 'off';
      } else {
         this.elementHtml.focus();
         this.elementHtml.attr('contenteditable', false);
      }
   },
   tools: function(tool) {
      var args = Array.prototype.slice.call(arguments);
      args.shift();

      if ($.ui.richtext.Tools[tool]) {
         $.ui.richtext.Tools[tool].command(this._createUI(), args);
      }
   },
   value: function() {
      return this._valueFromHtmlArea();
   },
   //length: function() {
      //return this._someOtherValue();
   //},
   destroy: function() {
      $.Widget.prototype.destroy.apply(this, arguments); // default destroy
      // now do other stuff particular to this widget
      this._updateElement();
      this.elementHtml.detach();
      this._editor = null;
      this.element.unwrap().show();
   }
});


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
      button: {type:'button', options: {label:'B'}},
      command: function(ui) { ui.richtext._exec("bold"); },
      update: function(ui) {  }
   },
   italic: {
      button: {type:'button', options: {label:'I'}},
      command: function(ui) { ui.richtext._exec("italic"); },
      update: function(ui) {  }
   },
   underline: {
      button: {type:'button', options: {label:'U'}},
      command: function(ui) { ui.richtext._exec("underline"); },
      update: function(ui) {  }
   },
   strikeThrough: {
      button: {type:'button', options: {label:'S'}},
      command: function(ui) { ui.richtext._exec("strikethrough"); },
      update: function(ui) {  }
   },
   viewSource: {
      button: {type:'checkbox', options: {label:'Source'}},
      command: function(ui, args) { 
         if (args.length && args[0]) {
            ui.richtext._updateElement();
            ui.richtext.elementHtml.hide(); 
            ui.richtext.element.show(); 
         } else {
            ui.richtext._updateHtmlArea();
            ui.richtext.element.hide(); 
            ui.richtext.elementHtml.show();
         }
      }
   },
})

})(jQuery);
