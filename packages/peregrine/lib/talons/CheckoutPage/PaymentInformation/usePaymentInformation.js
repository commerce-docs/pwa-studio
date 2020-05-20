import { useCallback, useState, useEffect } from 'react';
import { useQuery, useApolloClient } from '@apollo/react-hooks';
import { useFieldState } from 'informed';

import { useAppContext } from '../../../context/app';
import { useCartContext } from '../../../context/cart';

/**
 *
 * @param {Function} props.onSave callback to be called when user clicks review order button
 * @param {Function} props.resetReviewOrderButtonClicked callback to reset the review order button flag
 * @param {DocumentNode} props.queries.getPaymentDetailsQuery query to fetch selected payment method and payment nonce details
 *
 * @returns {
 *   doneEditing: Boolean,
 *   isEditModalHidden: Boolean,
 *   showEditModal: Function,
 *   hideEditModal: Function,
 *   handlePaymentError: Function,
 *   handlePaymentSuccess: Function,
 *   currentSelectedPaymentMethod: String,
 *   checkoutStep: Number,
 *
 * }
 */
export const usePaymentInformation = props => {
    const {
        onSave,
        resetReviewOrderButtonClicked,
        queries,
        undoPaymentInformationDone
    } = props;
    const {
        getPaymentDetailsQuery,
        getPriceSummaryQuery,
        getPaymentNonceQuery
    } = queries;

    /**
     * Definitions
     */

    /**
     * We use `skipQueryCall` boolean to make sure the payment details
     * query is only called once on load.
     */
    const [skipQueryCall, setSkipQueryCall] = useState(false);
    const [hasData, setHasData] = useState(false);
    const [{ drawer }, { toggleDrawer, closeDrawer }] = useAppContext();
    const isEditModalActive = drawer === 'edit.payment';
    const { value: currentSelectedPaymentMethod } = useFieldState(
        'selectedPaymentMethod'
    );
    const [{ cartId }] = useCartContext();
    const client = useApolloClient();

    /**
     * Helper Functions
     */

    const showEditModal = useCallback(() => {
        toggleDrawer('edit.payment');
    }, [toggleDrawer]);

    const hideEditModal = useCallback(() => {
        closeDrawer('edit.payment');
    }, [closeDrawer]);

    const handlePaymentSuccess = useCallback(() => {
        if (onSave) {
            onSave();
        }

        setHasData(true);
    }, [onSave]);

    const handlePaymentError = useCallback(() => {
        resetReviewOrderButtonClicked();
        setHasData(false);
    }, [resetReviewOrderButtonClicked]);

    const onPaymentDetailsQueryCompleted = useCallback(
        paymentDetailsData => {
            /**
             * If there is a selected payment method saved on cart,
             * and paymentNonceDetails in cache, it means the payment
             * information step is completed. Call onSave to move to next step.
             *
             * Do not call if paymentNonceDetails is not in cache, because we
             * need it to render the summary. There is no way to save it on
             * the remote server, hence we save it in local cache.
             */
            const selectedPaymentMethodOnCart =
                paymentDetailsData &&
                paymentDetailsData.cart.selectedPaymentMethod
                    ? paymentDetailsData.cart.selectedPaymentMethod.code
                    : null;
            const paymentNonceDetails = paymentDetailsData
                ? paymentDetailsData.cart.paymentNonce
                : null;

            const hasData = !!(
                selectedPaymentMethodOnCart && paymentNonceDetails
            );

            if (hasData) {
                if (onSave) {
                    onSave();
                }
            }

            setHasData(hasData);
            setSkipQueryCall(true);
        },
        [onSave]
    );

    const clearPaymentDetails = useCallback(() => {
        client.writeQuery({
            query: getPaymentNonceQuery,
            data: {
                cart: {
                    __typename: 'Cart',
                    id: cartId,
                    paymentNonce: null
                }
            }
        });
    }, [cartId, client, getPaymentNonceQuery]);

    /**
     * Queries
     */

    useQuery(getPaymentDetailsQuery, {
        variables: { cartId },
        skip: skipQueryCall,
        onCompleted: onPaymentDetailsQueryCompleted
    });

    const { data: priceSummaryData } = useQuery(getPriceSummaryQuery, {
        variables: { cartId }
    });

    const total = priceSummaryData
        ? priceSummaryData.cart.prices.grand_total.value
        : 0;

    const selectedPaymentMethod =
        total === 0 ? 'free' : currentSelectedPaymentMethod;

    /**
     * Effects
     */

    useEffect(() => {
        if (selectedPaymentMethod) {
            undoPaymentInformationDone();
            clearPaymentDetails();
            setHasData(false);
        }
    }, [
        selectedPaymentMethod,
        undoPaymentInformationDone,
        clearPaymentDetails
    ]);

    return {
        doneEditing: hasData,
        isEditModalHidden: !isEditModalActive,
        showEditModal,
        hideEditModal,
        handlePaymentSuccess,
        handlePaymentError,
        total,
        currentSelectedPaymentMethod: selectedPaymentMethod
    };
};
