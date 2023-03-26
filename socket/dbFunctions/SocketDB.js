const Firebase = require("../../firebase/firebase");
const moment = require("moment");
const {
  RedeemVoucherFunc,
} = require("../../controllers/functions/RedeemVoucher");
const Notification = require("../../models/notifications");
const Order = require("../../models/orders");
const Customer = require("../../models/customer");
const Vendor = require("../../models/vendor");
const rider = require("../../models/rider");
const Haversine = require("../../controllers/functions/HaversineFormula");

exports.onSendRequestFromCustomer = async (data) => {
  try {
    console.log(data);

    const type = data.type;
    const reorder = data.reorder;
    const timestampDate = new Date(data.date);
    const timestampTime = new Date(data.time);

    const timestampTime2 = new moment(data.time);
    console.log(timestampTime2);
    console.log(timestampTime2.hour());
    console.log(timestampTime.getHours());
    const time = {
      hours: timestampTime.getHours(),
      minutes: timestampTime.getMinutes(),
    };

    const date = {
      day: timestampDate.getDate(),
      month: timestampDate.getMonth() + 1,
      year: timestampDate.getFullYear(),
    };

    let items = data.item;
    const vendorID = data.vendorId;
    const customerID = data.customerId;
    const total = data.total;
    const eventID = data.eventId;
    const fromEvent = data.fromEvent;
    const allergen = data.allergen;

    const customer = await Customer.findById(customerID);
    const vendor = await Vendor.findById(vendorID);

    items = await items.map((item) => {
      item.item = item.id;
      delete item["image"];
      delete item["id"];
      delete item["price"];
      delete item["name"];
      return item;
    });
    var transaction;
    var order;
    if (data.coupon && data.total == 0) {
      RedeemVoucherFunc(data.vendorId, data.coupon);
      order = new Order({
        customer: customerID,
        paid: false,
        items: items,
        total: total,
        vendor: vendorID,
        fromEvent: fromEvent,
        event: eventID,
        orderStatus: "requested",
        review: null,
        coupon: data.coupon,
        // transaction: transaction,
        paymentMethod: "",
        allergen: allergen,
        orderStatus: "requested",
        type: type,
        date: date,
        time: time,
      });
    } else if (data.coupon && data.total != 0) {
      RedeemVoucherFunc(data.vendorId, data.coupon);
      transaction = {
        amount: total,
        currency: "eur",
        customer: customer.stripeId,
        description: "Order From " + customer.name,
        receipt_email: customer.email,
        source: data.card.cardId,
        metadata: {},
      };
      order = new Order({
        customer: customerID,
        paid: false,
        items: items,
        total: total,
        vendor: vendorID,
        fromEvent: fromEvent,
        event: eventID,
        orderStatus: "requested",
        review: null,
        coupon: data.coupon,
        transaction: transaction,
        paymentMethod: "",
        allergen: allergen,
        orderStatus: "requested",
        type: type,
        date: date,
        time: time,
      });
    } else {
      transaction = {
        amount: total,
        currency: "eur",
        customer: customer.stripeId,
        description: "Order From " + customer.name,
        receipt_email: customer.email,
        source: data.card.cardId,
        metadata: {},
      };

      order = new Order({
        customer: customerID,
        paid: false,
        items: items,
        total: total,
        vendor: vendorID,
        fromEvent: fromEvent,
        event: eventID,
        orderStatus: "requested",
        review: null,
        transaction: transaction,
        paymentMethod: "",
        allergen: allergen,
        orderStatus: "requested",
        type: type,
        date: date,
        time: time,
      });
    }

    const orderResponse = await order.save();
    var notification;
    if (reorder === true) {
      if (type === "normal") {
        notification = new Notification({
          vendor: vendorID,
          customer: customerID,
          sentBy: "customer",
          type: "order",
          text: customer.name + " Made a (Reorder) Order Request",
          readStatus: false,
          order: orderResponse._id,
        });
      }
      if (type === "preorder") {
        notification = new Notification({
          vendor: vendorID,
          customer: customerID,
          sentBy: "customer",
          type: "order",
          text: customer.name + " Made a (Reorder) Pre Order Request",
          readStatus: false,
          order: orderResponse._id,
        });
      }
    } else {
      if (type === "normal") {
        notification = new Notification({
          vendor: vendorID,
          customer: customerID,
          sentBy: "customer",
          type: "order",
          text: customer.name + " Made a Order Request",
          readStatus: false,
          order: orderResponse._id,
        });
      }
      if (type === "preorder") {
        notification = new Notification({
          vendor: vendorID,
          customer: customerID,
          sentBy: "customer",
          type: "order",
          text: customer.name + " Made a Pre Order Request",
          readStatus: false,
          order: orderResponse._id,
        });
      }
    }

    await notification.save();

    if (vendor.fcmToken) {
      const orderDetails = await Order.findById(order._id)
        .populate("customer")
        .populate("vendor");
      if (type === "normal") {
        if (reorder === true) {
          await Firebase.VendorNotify(
            "Reorder Request from " + orderDetails.customer.name,
            "Customer is Waiting, Respond to  Order Request",
            orderDetails.vendor.fcmToken
          );
        } else {
          console.log("object");
          await Firebase.VendorNotify(
            "New Order Request from " + orderDetails.customer.name,
            "Customer is Waiting, Respond to  Order Request",
            orderDetails.vendor.fcmToken
          );
        }
      }
      if (type === "preorder") {
        if (reorder === true) {
          await Firebase.VendorNotify(
            "Pre Order (Reorder) Request from " + orderDetails.customer.name,
            "Customer is Waiting, Respond to  Order Request",
            orderDetails.vendor.fcmToken
          );
        } else {
          await Firebase.VendorNotify(
            "Pre Order Request from " + orderDetails.customer.name,
            "Customer is Waiting, Respond to  Order Request",
            orderDetails.vendor.fcmToken
          );
        }
      }
    } else {
      // console.log("No FCM Token");
    }

    const newNotification = await Notification.findById(notification._id)
      .populate("customer")
      .populate("order");
    return {
      type: true,
      message: customer.name + " Requested A Order",
      data: { notification: newNotification, order: order },
    };
  } catch (error) {
    console.log(error);
    return { type: false, msg: "Server Not Responding", error: error };
  }
};
exports.riderAssignSocker = async (data) => {
  console.log(data.vendorId);
  // console.log(Object.keys(data));
  const riders = await rider.find({});

  const nearByRiders = riders.filter((rider) => {
    const distance = Haversine.CalculateDistance(
      data.latitude,
      data.longitude,
      rider.coordinates?.lat,
      rider.coordinates?.lng
    );

    if (distance <= 5) {
      return rider;
    }
    return false;
  });

  if (nearByRiders.length > 0) {
    const response = await Order.findByIdAndUpdate(data.orderId, {
      $set: {
        rider: nearByRiders[0]?._id,
        riderAccept: false,
        riderCount: nearByRiders.length - 1,
        riderCurrent: 0,
        riders: nearByRiders,
      },
    })
      .populate("vendor")
      .populate("items.item")
    if (response) {
      return {
        type: "success",
        result: "Rider has been assigned",
        order: response,
        rider: nearByRiders[0]?._id,
      };
    } else {
      return { type: "failure", result: "Server Not Responding" };
    }
  } else {
    return { type: "success", result: "Rider Not Found" };
  }
  return;
};
exports.riderAccept = async (data) => {
  const response = await Order.findByIdAndUpdate(data.orderId, {
    $set: { riderAccept: true },
  });
  if (response) {
    return { type: "success", result: "Rider has been accepted the order" };
  } else {
    return { type: "failure", result: "Server Not Responding" };
  }
};
exports.riderReject = async (data) => {
  const responseData = await Order.findOne({ _id: data.orderId });

  if (responseData.riderCount == responseData.riderCurrent) {
    return { type: "success", result: "No Rider is available" };
  }
  const response = await Order.findByIdAndUpdate(data.orderId, {
    $set: {
      rider: responseData.riders[responseData.riderCurrent + 1]?._id,
      riderAccept: false,
      riderCurrent: responseData.riderCurrent + 1,
    },
  });
  if (response) {
    return { type: "success", result: "Next Rider has been assigned" };
  } else {
    return { type: "failure", result: "Server Not Responding" };
  }
};
