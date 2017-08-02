window.addEventListener("load", function() {
    $("#shr").val(location.href);
    $("#gen").click(function() {
        $('#abusemodal').modal('show');
    });
    $("#history").click(function() {
        $('#historymodal').modal('show');
    });
    $("#share").click(function() {
        $('#sharemodal').modal('show');
    });
    if ($("#url").length) {
        url = $("#url").html();
        var l = document.createElement("a");
        l.href = url;
        $.ajax({
            type: 'POST',
            url: 'https://safebrowsing.googleapis.com/v4/threatMatches:find?key=AIzaSyCwHBGareGscYcX53FWeid0Yy6tL_-veKw',
            data: JSON.stringify({
                client: {
                    clientId: "Ethereum Scam Database",
                    clientVersion: "1.0.0"
                },
                threatInfo: {
                    threatTypes: ["THREAT_TYPE_UNSPECIFIED", "MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                    platformTypes: ["ANY_PLATFORM"],
                    threatEntryTypes: ["THREAT_ENTRY_TYPE_UNSPECIFIED", "URL", "EXECUTABLE"],
                    threatEntries: [{
                        "url": $("#url").html()
                    }]
                }
            }),
            success: function(data) {
                if('matches' in data && 0 in data.matches) {
					$("#googleblocked").css("color", "red");
					$("#googleblocked").html("Blocked");// for " + data.matches[0]['threatType']);
				} else {
					$("#googleblocked").css("color", "green");
					$("#googleblocked").html("Not Blocked <a target='_blank' href='https://safebrowsing.google.com/safebrowsing/report_phish/'><i class='warning sign icon'></i></a>");
				}
            },
            contentType: "application/json",
            dataType: 'json'
        });
        $.getJSON("https://raw.githubusercontent.com/409H/EtherAddressLookup/master/blacklists/domains.json", function(blacklist) {
            $.getJSON("https://raw.githubusercontent.com/409H/EtherAddressLookup/master/whitelists/domains.json", function(whitelist) {
                var holisticMetric = levenshtein(l.hostname.replace(/\./g, ''), "myetherwalletcom");
                var holisticStd = 3.639774978064392;
                var holisticLimit = 4 + (1 * holisticStd);
                var holisticStatus = (holisticMetric > 0 && holisticMetric < holisticLimit) ? true : false;
                if (($.inArray(l.hostname, blacklist) > -1 || holisticStatus) && !($.inArray(l.hostname, whitelist) > -1)) {
                    $("#blocked").css("color", "red");
                    $("#blocked").html("Blocked <a target='_blank' href='https://chrome.google.com/webstore/detail/etheraddresslookup/pdknmigbbbhmllnmgdfalmedcmcefdfn'><i class='help circle icon'></i></a>");
                } else {
                    $("#blocked").css("color", "green");
                    $("#blocked").html("Not Blocked <a target='_blank' href='https://chrome.google.com/webstore/detail/etheraddresslookup/pdknmigbbbhmllnmgdfalmedcmcefdfn'><i class='help circle icon'></i></a>");
                }
            });
        });
    }
});

function levenshtein(a, b) {
    if (a.length == 0) return b.length;
    if (b.length == 0) return a.length;

    // swap to save some memory O(min(a,b)) instead of O(a)
    if (a.length > b.length) {
        var tmp = a;
        a = b;
        b = tmp;
    }

    var row = [];
    // init the row
    for (var i = 0; i <= a.length; i++) {
        row[i] = i;
    }

    // fill in the rest
    for (var i = 1; i <= b.length; i++) {
        var prev = i;
        for (var j = 1; j <= a.length; j++) {
            var val;
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                val = row[j - 1]; // match
            } else {
                val = Math.min(row[j - 1] + 1, // substitution
                    prev + 1, // insertion
                    row[j] + 1); // deletion
            }
            row[j - 1] = prev;
            prev = val;
        }
        row[a.length] = prev;
    }

    return row[a.length];
}

function copyshr() {
    document.getElementById("shr").select();
    document.execCommand("copy");
}

function copyabuse() {
    document.getElementById("abuse").select();
    document.execCommand("copy");
}