function hideEverything() {
    $("#verified").hide();
    $("#blocked").hide();
    $("#neutral").hide();
    $("#helpmessage").hide();
}

window.addEventListener("load", function() {
    $('.ui.button').click(function() {
        $.getJSON("/api/check/" + encodeURIComponent($("input").val()), function(result) {
            if (result.result == 'verified') {
                hideEverything();
                $("#verified").css('display', 'flex');
            } else if (result.result == 'neutral') {
                hideEverything();
                $("#neutral").css('display', 'flex');
            } else if (result.result == 'blocked') {
                hideEverything();
                blocked = true;
                if ('category' in result.entries[0] && result.type == 'domain') {
                    $("#blacklistmessage").html('This domain was put on the blacklist for ' + result.entry.category.toLowerCase() + '.');
                } else if(result.type == 'address') {
					 $("#blacklistmessage").html('This address was put on the blacklist.');
				}
                $("#blacklistmessage").html($("#blacklistmessage").html() + ' <a id="details" href="/scam/' + result.entry.id + '">Details <i class="chevron right small icon"></i></a>');
                $("#blocked").css('display', 'flex');
            }

        });
    });
});