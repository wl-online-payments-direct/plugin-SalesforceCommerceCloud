'use strict';

function getSubscriptionData() {
	
	return {
		wlSubscriptionFrequency: $('#wlSubscriptionFrequency').val(),
		wlSbscriptionPeriod: parseInt($('#wlSbscriptionPeriod').val()),
		wlSubscriptionStartDate: $('#wlSubscriptionStartDate').val(),
		wlSubscriptionEndDate: $('#wlSubscriptionEndDate').val(),
		wlSubscriptionReplenishOrder: $('#wlSubscriptionReplenishOrder').is(':checked') ? 1 : 0
	}
	
}

function setSubscriptionDate(data) {
	var url =$('#wlSubscriptionReplenishOrder').data('url');
	$.ajax({
        url: url,
        type: 'post',
        dataType: 'json',
        data: data,
	});
}

function addLeadingZero(variable) {
	return (variable < 10) ? '0' + variable : variable;
}

function cancelSubscription(orderNo, url) {
	var data = {
		"orderNo": orderNo	
	};
	var result;
	
	$.ajax({
        url: url,
        type: 'post',
        dataType: 'json',
        data: data,
	}).done(function(response) {
		if (response.success) {
			location.reload();
		}
	});

}

$(document).ready(() => {
    $('#wlSubscriptionReplenishOrder').on('change', (e) => {
    	if ($('#wlSubscriptionFormValues').is(':visible')) {
    		$('#wlSubscriptionFormValues').hide();
    	} else {
    		$('#wlSubscriptionFormValues').show();
    	}
    	var data = getSubscriptionData();
		setSubscriptionDate(data);
    });
    
    $('.subscription #wlSubscriptionStartDate').on('change', (e) => {
    	var wlSubscriptionEndDate = $('.subscription #wlSubscriptionEndDate');
    	var originalDate = new Date(wlSubscriptionEndDate.val());
    	var date = new Date($('#wlSubscriptionStartDate').val());
    	date.setDate(date.getDate() + 1);
    	var month = parseInt(date.getMonth()) +  1; //January is 0
    	var newDateStr = date.getFullYear() + '-' + addLeadingZero(month) + '-' + addLeadingZero(date.getDate());
    	wlSubscriptionEndDate.attr('min', newDateStr);
		var data = getSubscriptionData();
		setSubscriptionDate(data);
    });
    
    $('.subscription #wlSubscriptionEndDate').on('change', (e) => {
		var data = getSubscriptionData();
		setSubscriptionDate(data);
    });
    
    $('.subscription #wlSbscriptionPeriod').on('change', (e) => {
		var data = getSubscriptionData();
		setSubscriptionDate(data);
    });
    
    $('.subscription #wlSubscriptionFrequency').on('change', (e) => {
		var data = getSubscriptionData();
		setSubscriptionDate(data);
    });
    
    $('.cancel-subscription').on('click', (e) => {
    	var el = $(e.target);
    	if (confirm(el.data('confirmmsg'))) {
    		cancelSubscription(el.data('order'), el.data('url'));
    	}
    });
});
