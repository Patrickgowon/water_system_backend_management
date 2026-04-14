const axios = require('axios');

exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required',
      });
    }

    // Call Paystack verify API
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = response.data;

    if (data.data.status === 'success') {
      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: data.data,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Payment not successful',
      });
    }

  } catch (error) {
    console.error('VERIFY ERROR:', error.response?.data || error.message);

    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
    });
  }
};