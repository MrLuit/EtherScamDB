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
					$("#googleblocked").css("color", "green");
					$("#googleblocked").html("Blocked");// for " + data.matches[0]['threatType']);
				} else {
					$("#googleblocked").css("color", "red");
					$("#googleblocked").html("Not Blocked <a target='_blank' href='https://safebrowsing.google.com/safebrowsing/report_phish/'><i class='warning sign icon'></i></a>");
				}
            },
            contentType: "application/json",
            dataType: 'json'
        });
    }
});

function copyshr() {
    document.getElementById("shr").select();
    document.execCommand("copy");
}

function copyabuse() {
    document.getElementById("abuse").select();
    document.execCommand("copy");
}