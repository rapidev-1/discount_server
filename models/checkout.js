const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const ProductsSchema = new Schema({
  item: { type: Schema.Types.ObjectId, ref: "item" },
  quantity: { type: Number, required: true },
  acceptedbyvendor: { type: String},
  status: { type: String },
});
const checkoutSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "customer" },
    items: [ProductsSchema],
    // total: { type: Number, required: true },    
  },
  { timestamps: true }
);

module.exports = mongoose.model("checkout", checkoutSchema);
