'use strict';

var isLoadedTokenizer = false;

var checkoutMainID = 'checkout-main';
var hostedTokenizationPaymentMethodID = 'WORLDLINE_DIRECT_CARD';
var hostedTokenizationDivID = 'HostedTokenizationDiv';

var paymentInformationDiv = $('.payment-information');
var hostedTokenizationSessionIdField = $('#HostedTokenizationSessionID');
var billingForm = $("#dwfrm_billing");

window.tokenizer = window.tokenizer || {};

/**
 * @param {Function} onReady A callback function to execute when the iframe loads.
 * Initializes the Hosted Tokenization Form
 */
function initTokenizerForm(onReady) {
    billingForm.spinner().start();

    var hostedTokenizationDiv = $('#' + hostedTokenizationDivID);
    var createHTPSessionURL = hostedTokenizationDiv.data('url');

    // reset hostedTokenizationField value and hostedTokenizationDiv content
    hostedTokenizationSessionIdField.val('');
    hostedTokenizationDiv.html('');

    $.getJSON(createHTPSessionURL, function (sessionResponse) {
        if (!sessionResponse.error && 'redirectUrl' in sessionResponse) {
            window.tokenizer = new window.Tokenizer(sessionResponse.redirectUrl, hostedTokenizationDivID, { hideCardholderName: false, hideTokenFields: false });

            window.tokenizer.initialize()
                            .then(function (tokenizerResponse) {
                                var $iframeEl = hostedTokenizationDiv.find('iframe');
                                $iframeEl.css({ width: '100%', border: 0 });

                                billingForm.spinner().stop();

                                if (typeof onReady === "function") {
                                    onReady();
                                }
                            })
                            .catch(function (tokenizerError) {
                                billingForm.spinner().stop();
                                console.error(tokenizerError); // eslint-disable-line no-console
                            });
        }
    });
}

/**
 * Initializes event listeners required for Hosted Tokenization functionality
 */
function initializeHostedTokenizationEvents() {
    var checkoutMain = document.getElementById(checkoutMainID);
    var checkoutStageAttr = 'data-checkout-stage';
    var checkoutStepChanged = function (mutationsList, observer) {
        mutationsList.forEach(function (mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === checkoutStageAttr) {
                if (checkoutMain.getAttribute(mutation.attributeName) === 'payment') {
                    const hasSavedCreditCards = $('.credit-card-selector-block').length > 0;
                    if (!hasSavedCreditCards) {
                        initTokenizerForm();
                    }
                }
            }
        });
    };

    var observer = new MutationObserver(checkoutStepChanged);
    observer.observe(checkoutMain, { attributes: true, childList: false, subtree: false });

    $('.submit-payment').on('click.worldline', function (e) {
        if (paymentInformationDiv.data('payment-method-id') === hostedTokenizationPaymentMethodID && hostedTokenizationSessionIdField.val() == '') {
            e.stopImmediatePropagation();
            window.tokenizer.submitTokenization().then(function (result) {
                if (result.success) {
                    hostedTokenizationSessionIdField.val(result.hostedTokenizationId);
                    $('.submit-payment').trigger('click');
                }
            });
        }
    });

    if (checkoutMain.getAttribute(checkoutStageAttr) === 'payment') {
        const hasSavedCreditCards = $('.credit-card-selector-block').length > 0;
        if (!hasSavedCreditCards) {
            initTokenizerForm();
        }
    }
}

/**
 * Requires Tokenizer script and calls initializeEvents()
 */
function initTokenizer() {
    var tokenizerUrl = $('#WorldlineTokenizerScriptUrl').attr('href');

    if (!isLoadedTokenizer) {
        var script = document.createElement('script');
        script.onload = function () {
            isLoadedTokenizer = true;
            initializeHostedTokenizationEvents();
        };
        script.src = tokenizerUrl;
        script.async = true;
        document.head.appendChild(script);
    } else {
        initializeHostedTokenizationEvents();
    }
}

/**
 * Event handling for the saved cards block.
 */
function initSavedCards() {
    const $creditCardSelectorBlock = $(".credit-card-selector-block");
    var hostedTokenizationDiv = $('#' + hostedTokenizationDivID);
    var createHTPSessionURL = hostedTokenizationDiv.data('url');

    $('.js-worldlineDirectCardSeletor').on("change.worldline", (e) => {
        const $target = $(e.target);
        const $cardRow = $target.closest(".card-row");

        hostedTokenizationDiv.closest("tr").remove();
        hostedTokenizationDiv.remove();
        const newTokenizationDiv = document.createElement("div");
        newTokenizationDiv.id = hostedTokenizationDivID;
        newTokenizationDiv.dataset.url = createHTPSessionURL;

        const newTR = document.createElement("tr");
        const newTD = document.createElement("td");
        newTD.colSpan = 5;
        newTR.appendChild(newTD);
        newTD.appendChild(newTokenizationDiv);
        $cardRow.after(newTR);

        hostedTokenizationDiv = $(newTokenizationDiv);

        initTokenizerForm(function () {
            window.tokenizer.useToken($target.val());
        });
    });

    $creditCardSelectorBlock.find(".card-row").on("click", function (e) {
        const $target = $(e.target);
        if ($target.attr("type") === "radio") {
            return;
        }

        const $radioButton = $target.closest(".card-row").find(".js-worldlineDirectCardSeletor");
        $radioButton.trigger("click");
    });
}

/**
 * Main function executed on document.ready event
 */
$(document).ready(function () {
    var isHostedTokenization = $('[data-method-id="' + hostedTokenizationPaymentMethodID + '"]').length;
    if (isHostedTokenization) {
        initTokenizer();
        initSavedCards();
    }
});
