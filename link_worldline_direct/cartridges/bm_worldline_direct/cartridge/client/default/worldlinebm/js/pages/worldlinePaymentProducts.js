const Ext = /** @type {ExtJS} */ (window.Ext);

/**
 * @type {jQuery} jQuery instance
 */
let $;

let extDialog;
const showExtJSDialog = (data) => {
    extDialog = new Ext.Window({
        title: "",
        width: 400,
        height: 200,
        modal: true,
        autoScroll: true,
        cls: 'worldlinebm_window_content payment_product_dialog'
    });

    extDialog.show();
    $('#' + extDialog.body.id).html(data);
    extDialog.setHeight('auto');
    extDialog.setWidth('auto');
    extDialog.center();
};

/**
 * Initializes the events on the page.
 * @param {jQuery} _$ jQuery instance
 */
const init = (_$) => {
    $ = _$;

    const initEditDialogEvents = () => {
        const $form = $("form.view_payment_product");
        $form.on("submit", (e) => {
            e.preventDefault();

            $.ajax({
                url: $form.attr("action"),
                method: $form.attr("method"),
                data: $form.serialize(),
                error: function () {
                    alert("An error occurred, please try again.");
                },
                success: function (data) {
                    if (!data.success) {
                        alert("An error occurred, please try again.");
                        return;
                    }
                    extDialog.hide();
                    window.location.reload();
                }
            });
        });

        $form.find(".btn_delete").on("click", (e) => {
            e.preventDefault();
            const $clickedLink = $(e.target);

            if (!confirm("Are you sure you want to delete this payment product?")) {
                return;
            }

            $.ajax({
                url: $clickedLink.data("action"),
                method: "POST",
                error: function () {
                    alert("An error occurred, please try again.");
                },
                success: function (data) {
                    if (!data.success) {
                        alert("An error occurred, please try again.");
                        return;
                    }
                    extDialog.hide();
                    window.location.reload();
                }
            });
        });
    };

    $(".btn_add_payment_product").on("click", (e) => {
        e.preventDefault();
        const $clickedLink = $(e.target);

        $.ajax({
            url: $clickedLink.data("action"),
            method: "GET",
            error: function () {
                alert("An error occurred, please try again.");
            },
            success: function (data) {
                showExtJSDialog(data);
                initEditDialogEvents();
            }
        });
    });

    $(".payment_product_list").on("click", ".btn_edit_payment_product", (e) => {
        e.preventDefault();
        const $clickedLink = $(e.target);
        const $tr = $clickedLink.closest("tr");

        const url = $tr.data("edit-url");

        $.ajax({
            url: url,
            method: "GET",
            error: function () {
                alert("An error occurred, please try again.");
            },
            success: function (data) {
                showExtJSDialog(data);
                initEditDialogEvents();
            }
        });
    });
};

exports.init = init;
