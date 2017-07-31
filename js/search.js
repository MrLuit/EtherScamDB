window.addEventListener("load", function() {
    $('#srch').dropdown({
        apiSettings: {
            url: '../_data/search_compiled.json'
        },
        filterRemoteData: true
    });
	$("#sr").change(function() {
		window.location = '/scam/' + $("#sr").val();
	});
});