Feature: Follow the happy path of a guest user
    As a shopper, I want to shop for a product and fill out the correct
    shipping information/billing information in checkout.

@singlePaymentMethod
    Scenario: Guest shopper should be able to follow the checkout flow
        When shopper selects yes or no for tracking consent
        Given Shopper searches for "Elbow Sleeve Ribbed Sweater"
        Then selects size "M"
        Then he adds the product to cart
        Then shopper goes to cart
        Then shopper changes product quantity to "2"
        And shopper selects checkout from cart
        And shopper selects checkout as guest
        And shopper fills out shipping information
        Then shopper proceeds to payment section
        And shopper fills out billing information
        
        #Then shopper selects Worldline payment method "iDeal"
        Then shopper selects Worldline payment method "VISA"
        #Then shopper selects Worldline payment method "MasterCard"
        #Then shopper selects Worldline payment method "American Express"
        #Then shopper selects Worldline payment method "Diners Club"
        #Then shopper selects Worldline payment method "JCB"
        #Then shopper selects Worldline payment method "Maestro"
        #Then shopper selects Worldline payment method "BCMC"
        
        Then shopper places order
        Then shopper confirms the order on the hosted checkout page
        Then shopper verifies the order confirmation page
