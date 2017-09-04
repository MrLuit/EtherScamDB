function hideEverything() {
	$("#verified").hide();
	$("#blocked").hide();
	$("#neutral").hide();
	$("#helpmessage").hide();
}

function extractHostname(url) {
    var hostname;

    if (url.indexOf("://") > -1) {
        hostname = url.split('/')[2];
    }
    else {
        hostname = url.split('/')[0];
    }

    hostname = hostname.split(':')[0];
    hostname = hostname.split('?')[0];

    return hostname;
}

function stripURL(url) {
	var domain = extractHostname(url),
        splitArr = domain.split('.'),
        arrLen = splitArr.length;

    if (arrLen > 2) {
        domain = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
    }
    return domain.toLowerCase();
}

window.addEventListener("load", function() {
    $('.ui.button').click(function() {
		var url = stripURL($("input").val());
		$.getJSON("/data/scams.json", function(scams) {
			$.getJSON("/data/whitelist.json", function(whitelist) {
				if($.inArray(url,whitelist) > -1) {
					hideEverything();
					$("#verified").css('display','flex');
				} else {
					var blocked = false;
					scams.forEach(function(scam,index) {
						if(stripURL(scam.url) == url) {
							hideEverything();
							blocked = true;
							if('category' in scam) {
								$("#blacklistmessage").html('This domain was put on the blacklist for ' + scam.category.toLowerCase() + '.');
							}
							$("#blacklistmessage").html($("#blacklistmessage").html() + ' <a id="details" href="/scam/' + scam.id + '">Details <i class="chevron right small icon"></i></a>');
							$("#blocked").css('display','flex');
						}
						if(index == scams.length-1 && !blocked) {
							hideEverything();
							$("#neutral").css('display','flex');
						}
					});
				}
			});
		});
	});
});