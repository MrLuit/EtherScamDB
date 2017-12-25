window.addEventListener("load", function() {
	$("th").click(function() {
		if($(this).html() != 'Info') {
			$("th").removeClass("sorted descending");
			$(this).addClass("sorted descending");
			path = window.location.pathname.split("/");
			if(!(2 in path) || path[2] == '') {
				window.location = "/scams/1/" + $(this).html().toLowerCase();
			} else {
				window.location = "/scams/" + path[2] + "/" + $(this).html().toLowerCase();
			}
		}
	});
});