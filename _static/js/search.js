function hideEverything() {
    $("#verified").hide();
    $("#blocked").hide();
    $("#neutral").hide();
    $("#helpmessage").hide();
}


window.addEventListener("load", function() {
    $('.ui.button').click(function() {
        $.getJSON("/api/check/" + encodeURIComponent($("input").val().toLowerCase().replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0]), function(result) {
            if (result.result == 'verified') {
                hideEverything();
                var strLink = '';
                $("#verifiedmessage").html('<b>' + encodeURI($("input").val().toLowerCase().replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0]) + '</b> is a verified domain. You can trust the contents.');
                strLink = '<a id="details" href="/domain/' + encodeURI($("input").val()) + '">Details on this domain <i class="chevron right small icon"></i></a>';
                $("#verifiedmessage").html($("#verifiedmessage").html() + ' ' + strLink);
                $("#verified").css('display', 'flex');
            } else if (result.result == 'neutral') {
                hideEverything();
                if(result.type == 'address'){
                    $("#neutralmessage").html('<b>' + encodeURI($("input").val().toLowerCase().replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0]) + '</b> wasn\'t a recognized ETH address.');
                    strLink = '<a id="details" href="https://etherscan.io/address/' + encodeURI($("input").val()) + '">View this address on Etherscan <i class="chevron right small icon"></i></a>';
                    $("#neutralmessage").html($("#neutralmessage").html() + ' ' + strLink);
                    $("#neutral").css('display', 'flex');
                }
                else{
                    $("#neutralmessage").html('<b>' + encodeURI($("input").val().toLowerCase().replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0]) + '</b> wasn\'t recognized as a malicious domain, nor as verified domain. Be careful!');
                    strLink = '<a id="details" href="/domain/' + encodeURI($("input").val()) + '">Details on this domain <i class="chevron right small icon"></i></a>';
                    $("#neutralmessage").html($("#neutralmessage").html() + ' ' + strLink);
                    $("#neutral").css('display', 'flex');
                }
            } else if (result.result == 'whitelisted') {
                hideEverything();
                var strLink = '';
                $("#verifiedmessage").html('<b>' + encodeURI($("input").val().toLowerCase().replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0]) + '</b> is a whitelisted address. You can trust it.');
                strLink = '<a id="details" href="/address/' + encodeURI($("input").val()) + '">Details on this address <i class="chevron right small icon"></i></a>';
                $("#verifiedmessage").html($("#verifiedmessage").html() + ' ' + strLink);
                $("#verified").css('display', 'flex');
            } else if (result.result == 'blocked') {
                hideEverything();
                blocked = true;
                var strLink = '';
                if (result.type == 'domain' && 'category' in result.entries[0]) {
                    $("#blacklistmessage").html('<b>' + encodeURI($("input").val().toLowerCase().replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0]) + '</b> was put on the blacklist for ' + result.entries[0].category.toLowerCase() + '.');
                    strLink = '<a id="details" href="/domain/' + encodeURI($("input").val()) + '">Details on this domain <i class="chevron right small icon"></i></a>';
                } else if(result.type == 'address') {
					          $("#blacklistmessage").html('<b>' + encodeURI($("input").val().toLowerCase()) + ' was put on the blacklist and is associated with '+ result.entries.length +' blocked domain(s).');
					          strLink = '<a id="details" href="/address/' + encodeURI($("input").val()) + '">Details on this address <i class="chevron right small icon"></i></a>';
				        } else if(result.type == 'ip') {
					          $("#blacklistmessage").html('<b>' + encodeURI($("input").val().toLowerCase().replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0]) + '</b> was put on the blacklist and is associated with '+ result.entries.length +' blocked domain(s)');
					          strLink = '<a id="details" href="/ip/' + encodeURI($("input").val()) + '">Details on this domain <i class="chevron right small icon"></i></a>';
				        }
                $("#blacklistmessage").html($("#blacklistmessage").html() + ' ' + strLink);
                $("#blocked").css('display', 'flex');
            }
        });
    });
});
