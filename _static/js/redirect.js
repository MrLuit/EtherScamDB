window.addEventListener("load", function() {
    $.urlParam = function(name) {
        var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results == null) {
            return null;
        } else {
            return decodeURIComponent(results[1]).toString() || 0;
        }
    }
	$("#domain").html($.urlParam('url'));
    $("button").click(function() {
        window.location = $.urlParam('url');
    });
});