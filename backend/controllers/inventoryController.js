const Store = require('../models/Store');
const Product = require('../models/Product');

exports.getSellerStore = async (req, res) => {
  try {
    const store = await Store.findOne({ sellerId: req.user.id });
    if (!store) return res.status(404).json({ message: 'Store not found for this seller' });
    res.json(store);
  } catch (error) {
    console.error('Fetch Seller Store Error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.updateInventoryByBarcode = async (req, res) => {
  const { barcode, incrementBy = 1 } = req.body;

  try {
    const product = await Product.findOne({ barcode });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Enforce multi-tenant seller-store security check
    const store = await Store.findOne({ sellerId: req.user.id });
    if (!store) return res.status(404).json({ message: 'Store not found for this seller' });

    const itemIndex = store.inventory.findIndex(item => item.productId.toString() === product._id.toString());
    
    if (itemIndex > -1) {
      store.inventory[itemIndex].stock += incrementBy;
    } else {
      store.inventory.push({ productId: product._id, barcode, stock: incrementBy });
    }

    await store.save();
    res.json({ message: 'Inventory updated successfully', product, inventory: store.inventory });
  } catch (error) {
    console.error('Inventory Error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};
