const Ext = /** @type {Ext} */ (window.Ext);

let ajaxDialog;
let initPaymentsDialogEvents;
let resources = {};
/**
 * @type {jQuery} jQuery instance
 */
let $;

/**
 * Shows an error message in case an API error is received.
 * @param {Object} apiResponse the error response from the API
 */
function showAPIErrorMessage(apiResponse) {
    if (apiResponse) {
        alert(resources.apiRequestFailedWith + "\n\n" + JSON.stringify(apiResponse, null, 4));
    } else {
        alert(resources.apiRequestFailed);
    }
}

/**
 * A helper function for sending AJAX requests that saves some boilerplate code.
 * @param {string} url the URL
 * @param {Object | null} data The POST parameters or null if none
 * @param {Function} callback callback function to execute if the request succeeds
 */
function sendAjaxRequest(url, data, callback) {
    $.ajax({
        url: url,
        method: "POST",
        data: data || null,
        error: function () {
            callback({
                errors: [{ message: resources.serverError }]
            });
        },
        success: function (response) {
            callback(response);
        }
    });
}

/**
 * A helper function for refreshing a div's contents using AJAX.
 * @param {jQuery} $targetDiv The jQuery div whose contents will be replaced with the AJAX response
 * @param {string} refreshURL The URL to call
 * @param {Function} callback The callback function to execute if the request succeeds
 */
function refreshAJAXComponent($targetDiv, refreshURL, callback) {
    $targetDiv.addClass('component-loading');

    $.ajax({
        url: refreshURL,
        error: function () {
            callback({
                errors: [{ message: resources.serverError }]
            });
        },
        success: function (data) {
            $targetDiv.html(data);
            $targetDiv.removeClass('component-loading');

            $targetDiv.find(".btn-refresh").on("click", function (e) {
                e.preventDefault();

                refreshAJAXComponent($targetDiv, refreshURL, function () {
                    initPaymentsDialogEvents();
                });
            });

            ajaxDialog.setHeight('auto');
            ajaxDialog.center();

            if (callback) {
                callback();
            }
        }
    });
}

/**
 * Binds the payment dialog event handlers.
 */
initPaymentsDialogEvents = () => {
    let $tabContentsDiv = $(".js_payment_transactions_tab_contents");
    let $paymentDetailsDiv = $(".js_payment_details");
    let $inputAmount = $('#ing_amount');
    let currencyCode = $paymentDetailsDiv.data('currency-code');

    $(".js_payment_transactions_tab_headings a").off("click").on("click", function (e) {
        e.preventDefault();

        var $clickedLink = $(e.target);

        $(".js_payment_transactions_tab_headings a").removeClass("selected");
        $clickedLink.addClass("selected");

        refreshAJAXComponent($tabContentsDiv, $clickedLink.data('contents-url'), function () {
            initPaymentsDialogEvents();
        });
    });

    $(".js_btn_capture").off("click").on("click", function (e) {
        e.preventDefault();

        let amount = parseFloat($inputAmount.val());
        if (isNaN(amount) || !(amount > 0)) {
            $inputAmount.focus();
            return;
        }

        var confirmationMsg = $(this).data('confirm') || resources.confirmationMessages.capture;

        if (!confirm(confirmationMsg.replace('{0}', amount).replace('{1}', currencyCode))) {
            return;
        }

        $paymentDetailsDiv.addClass("component-loading");
        sendAjaxRequest($paymentDetailsDiv.data('capture-payment-url'), { amount: amount }, function (res) {
            if (res.success === false) {
                showAPIErrorMessage(res.errorMessage);
            }

            refreshAJAXComponent($paymentDetailsDiv, $paymentDetailsDiv.data('refresh-details-url'), function () {
                initPaymentsDialogEvents();
            });
            $(".js_payment_transactions_tab_headings a.captures").click();
        });
    });

    $(".js_btn_cancel").off("click").on("click", function (e) {
        e.preventDefault();

        if (!confirm(resources.confirmationMessages.cancel)) {
            return;
        }

        $paymentDetailsDiv.addClass("component-loading");
        sendAjaxRequest($paymentDetailsDiv.data('cancel-payment-url'), null, function (res) {
            if (res.success === false) {
                showAPIErrorMessage(res.errorMessage);
            }

            refreshAJAXComponent($paymentDetailsDiv, $paymentDetailsDiv.data('refresh-details-url'), function () {
                initPaymentsDialogEvents();
            });
        });
    });

    $(".js_btn_refund").off("click").on("click", function (e) {
        e.preventDefault();

        let amount = parseFloat($inputAmount.val());
        if (isNaN(amount) || !(amount > 0)) {
            $inputAmount.focus();
            return;
        }

        if (!confirm(resources.confirmationMessages.refund.replace('{0}', amount).replace('{1}', currencyCode))) {
            return;
        }

        $paymentDetailsDiv.addClass("component-loading");
        sendAjaxRequest($paymentDetailsDiv.data('refund-payment-url'), { amount: amount, currencyCode: currencyCode }, function (res) {
            if (res.success === false) {
                showAPIErrorMessage(res.errorMessage);
            }

            refreshAJAXComponent($paymentDetailsDiv, $paymentDetailsDiv.data('refresh-details-url'), function () {
                initPaymentsDialogEvents();
            });
            $(".js_payment_transactions_tab_headings a.refunds").click();
        });
    });
};

/**
 * Binds the event handlers
 */
function initEvents() {
    $('#btn_test_connection').on('click', function (e) {
        e.preventDefault();
        let $clickedButton = $(this);

        $.ajax({
            url: $clickedButton.data('action')
        }).done(function (data) {
            if (data.success) {
                alert(resources.connectionSucceeded);
            } else {
                showAPIErrorMessage(data.errorMessage);
            }
        });
    });

    $('.js_worldlinebm_switch_order_search_forms').on('click', function (e) {
        e.preventDefault();
        var $clickedLink = $(e.target);

        $('.js_worldlinebm_order_search_form').addClass('hidden');
        $('#' + $clickedLink.data('targetid')).removeClass('hidden');
    });

    $('.js_worldline_ajax_dialog').on('click', function (e) {
        e.preventDefault();

        var $button = $(this);
        ajaxDialog = new Ext.Window({
            title: resources.detailsDialogTitle,
            width: 800,
            height: 200,
            modal: true,
            autoScroll: true,
            cls: 'worldlinebm_window_content payments-dialog'
        });
        ajaxDialog.show();
        ajaxDialog.maskOver = (function (panel) {
            return {
                ext: new Ext.LoadMask(panel.getEl()),
                show: function (type) {
                    this.ext.show();
                },
                hide: function () {
                    this.ext.hide();
                }
            };
        }(ajaxDialog));

        ajaxDialog.maskOver.show();
        $.ajax({
            url: $button.attr('href'),
            error: function () {
                ajaxDialog.maskOver.hide();
                if (ajaxDialog) {
                    ajaxDialog.close();
                }
            },
            success: function (data) {
                ajaxDialog.maskOver.hide();

                if (typeof data === "object" && data.success === false) {
                    ajaxDialog.close();

                    showAPIErrorMessage(data.errorMessage);
                    return;
                }

                if (ajaxDialog) {
                    $('#' + ajaxDialog.body.id).html(data);
                    ajaxDialog.setHeight('auto');
                    ajaxDialog.center();
                } else {
                    $('.js_worldlinebm_content').html(data);
                }


                if ($button.data('dialog-id') === 'payments-dialog') {
                    initPaymentsDialogEvents();
                    $(".js_payment_transactions_tab_headings a").first().click();
                }
            }
        });
        return false;
    });
}

/**
 * Entry point
 * @param {Object} config configuration object
 * @param {jQuery} _$ the jQuery instance
 */
function init(config, _$) {
    $ = _$;
    resources = config.resources;
    initEvents();
}

exports.init = init;
