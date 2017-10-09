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
                var strLink = '';
                if (result.type == 'domain' && 'category' in result.entries[0]) {
                    $("#blacklistmessage").html('This domain was put on the blacklist for ' + result.entries[0].category.toLowerCase() + '.');
                    strLink = '<a id="details" href="/scam/' + result.entries[0].id + '">Details <i class="chevron right small icon"></i></a>';
                } else if(result.type == 'address') {
					 $("#blacklistmessage").html('This address was put on the blacklist and is associated with '+ result.entries.length +' blocked domain(s)');
					 strLink = '<a id="details" href="/address/' + result.input + '">Details <i class="chevron right small icon"></i></a>';
				} else if(result.type == 'ip') {
					 $("#blacklistmessage").html('This ip address was put on the blacklist and is associated with '+ result.entries.length +' blocked domain(s)');
					 strLink = '<a id="details" href="/ip/' + result.input + '">Details <i class="chevron right small icon"></i></a>';
				} 
                $("#blacklistmessage").html($("#blacklistmessage").html() + ' ' + strLink);
                $("#blocked").css('display', 'flex');
            }
        });
    });
});