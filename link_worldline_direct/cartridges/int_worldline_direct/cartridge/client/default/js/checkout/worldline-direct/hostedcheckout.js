'use strict';

var isGroupCardsEnabled = false;

/**
 * Event handling for hosted-checkout billing page
 */
function initHostedCheckoutPage() {
    var $creditCardSelectorBlock = $(".credit-card-selector-block");

    $('.js-worldlineDirectCardSeletor').on("change.worldline", (e) => {
        var $target = $(e.target);
        var worldlinePaymentProductID = $target.data("worldlinepaymentproductid");

        $(".js-form-control-savedCardToken").val($target.val());

        $creditCardSelectorBlock.find(".card-row").removeClass("selected");
        $target.closest(".card-row").addClass("selected");

        if (isGroupCardsEnabled) {
            $("[data-method-id='WORLDLINE_DIRECT_REDIRECT__CARDS'] a").trigger("click", { dontUpdateSavedCards: true });
        } else {
            $("[data-method-id='WORLDLINE_DIRECT_REDIRECT__" + worldlinePaymentProductID + "'] a").trigger("click", { dontUpdateSavedCards: true });
        }
    });

    $creditCardSelectorBlock.find(".card-row").on("click", function (e) {
        var $target = $(e.target);
        if ($target.attr("type") === "radio") {
            return;
        }

        var $radioButton = $target.closest(".card-row").find(".js-worldlineDirectCardSeletor");
        $radioButton.trigger("click");
    });

    $('.payment-options .nav-item').on('click.worldline', function (e, extraParameters) {
        e.preventDefault();

        if (!extraParameters || extraParameters.dontUpdateSavedCards !== true) {
            $('.js-worldlineDirectCardSeletor[value=""]').trigger("click");
        }
    });

    var $selectedSavedCardOption = $('.js-worldlineDirectCardSeletor:checked');
    if ($selectedSavedCardOption.length > 0) {
        $selectedSavedCardOption.trigger('change');
    } else {
        $('.js-worldlineDirectCardSeletor[value=""]').trigger("click");
    }
}

$(document).ready(function () {

    var $paymentInformation = $('.payment-information');

    isGroupCardsEnabled = $paymentInformation.data('groupcardsenabled');

    if ($paymentInformation.data('hostedtokenizationenabled') === false) {
        initHostedCheckoutPage();
    }
});
