window.addEventListener("load", function() {
    $('#srch').dropdown({
        apiSettings: {
            url: '/data/search.json'
        },
        filterRemoteData: true
    });
	$("#sr").change(function() {
		window.location = '/scam/' + $("#sr").val();
	});
});