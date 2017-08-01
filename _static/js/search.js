window.addEventListener("load", function() {
    $('#srch').dropdown({
        apiSettings: {
            url: '/search/search.json'
        },
        filterRemoteData: true
    });
	$("#sr").change(function() {
		window.location = '/scam/' + $("#sr").val();
	});
});