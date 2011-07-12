/**
 * Site UI
 */
$(function() {

   $('#switcher').themeswitcher();

	function showTab(tabName) {
		var scrollVal = $(document).scrollTop();

		$('.tab-pane').addClass('tabHidden');
		$('#'+tabName).removeClass('tabHidden');

		$('#menu a').removeClass('selected');
		$('#menu a[href="#'+tabName+'"]').addClass('selected');

		setTimeout(function() { $(document).scrollTop(scrollVal); }, 0);
	}

	
	var anchorSep = document.location.href.indexOf('#');
	showTab( 0 <= anchorSep ? document.location.href.substr(anchorSep+1) : 'home' );

	$('a.tab').click(function(e) {
		showTab( $(this).attr('href').substr(1) );
		e.stopPropagation();
		return false;
	});

});
