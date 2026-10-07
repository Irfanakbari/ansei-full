/* By Irfan Akbari Vuteq Indonesia - 2026-10-06 */
export interface DeliveryProgressSource {
  PoId: string;
  Qty: number;
  LabelData: { LabelNumber: string; QtyThisBox: number }[];
  DeliveryHistory: {
    ProductionDemandId: string;
    LabelDataId: string;
    Qty: number;
  }[];
}

/** Shared by delivery admission and the public production monitor. */
export function getDeliveryProgress(order: DeliveryProgressSource) {
  const labels = new Map(
    order.LabelData.map((label) => [label.LabelNumber, label]),
  );
  const matched = order.DeliveryHistory.filter(
    (delivery) =>
      delivery.ProductionDemandId === order.PoId &&
      labels.get(delivery.LabelDataId)?.QtyThisBox === delivery.Qty,
  );
  const labelQty = order.LabelData.reduce(
    (sum, label) => sum + label.QtyThisBox,
    0,
  );
  const deliveredQty = matched.reduce((sum, delivery) => sum + delivery.Qty, 0);
  const historyQty = order.DeliveryHistory.reduce(
    (sum, delivery) => sum + delivery.Qty,
    0,
  );
  const labelSetupValid = order.LabelData.length > 0 && labelQty === order.Qty;
  const recordsValid =
    matched.length === order.DeliveryHistory.length && historyQty <= order.Qty;
  return {
    labelQty,
    deliveredQty,
    historyQty,
    deliveredLabels: matched.length,
    pendingLabels: order.LabelData.length - matched.length,
    pendingQty: Math.max(0, order.Qty - deliveredQty),
    labelSetupValid,
    recordsValid,
    complete:
      labelSetupValid &&
      matched.length === order.LabelData.length &&
      order.DeliveryHistory.length === order.LabelData.length &&
      historyQty === order.Qty,
    issue:
      order.LabelData.length === 0
        ? 'Delivery labels have not been generated.'
        : labelQty !== order.Qty
          ? 'Label quantities do not match the PO target.'
          : 'Some labels have no matching delivery record.',
  };
}
