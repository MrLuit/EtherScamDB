function hideEverything() {
    $("#verified").hide();
    $("#blocked").hide();
    $("#neutral").hide();
    $("#helpmessage").hide();
}

window.addEventListener("load", function() {
    $('.ui.button').click(function() {
        $.getJSON("/api/check/" + encodeURIComponent($("input").val()), function(result) {
			if(result.result == 1) {
				hideEverything();
                $("#verified").css('display', 'flex');
			} else if(result.result == 0) {
				hideEverything();
                            $("#neutral").css('display', 'flex');
			} else if(result.result == -1) {
				hideEverything();
                            blocked = true;
                            if ('category' in scam) {
                                $("#blacklistmessage").html('This domain was put on the blacklist for ' + scam.category.toLowerCase() + '.');
                            }
                            $("#blacklistmessage").html($("#blacklistmessage").html() + ' <a id="details" href="/scam/' + scam.id + '">Details <i class="chevron right small icon"></i></a>');
                            $("#blocked").css('display', 'flex');
			}
            
        });
    });
});