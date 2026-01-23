from rest_framework import serializers
from .models import FeeHead, FeeStructure, StudentFee, FeeTransaction, FeeAmount, GlobalFeeSetting, Receipt

class GlobalFeeSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalFeeSetting
        fields = '__all__'

class FeeAmountSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeAmount
        fields = ['id', 'class_name', 'amount']


class FeeHeadSerializer(serializers.ModelSerializer):
    amounts = FeeAmountSerializer(many=True, read_only=True)

    class Meta:
        model = FeeHead
        fields = [
            'id', 'name', 'description', 'session', 'amounts',
            'frequency', 'due_day', 'due_months', 'installment_count',
            'late_fee_amount', 'grace_period_days', 'is_transport_fee'
        ]

class FeeStructureSerializer(serializers.ModelSerializer):
    fee_head_name = serializers.ReadOnlyField(source='fee_head.name')

    class Meta:
        model = FeeStructure
        fields = '__all__'

class StudentFeeSerializer(serializers.ModelSerializer):
    fee_head_name = serializers.ReadOnlyField(source='fee_head.name')
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentFee
        fields = '__all__'
    
    def get_student_name(self, obj):
        return str(obj.student)

class FeeTransactionSerializer(serializers.ModelSerializer):
    fee_head_name = serializers.SerializerMethodField()
    class Meta:
        model = FeeTransaction
        fields = ['id', 'student', 'fee_head', 'fee_head_name', 'receipt', 'amount_paid', 'installment_number', 'payment_date', 'remarks']
    
    def get_fee_head_name(self, obj):
        if obj.fee_head and obj.fee_head.is_transport_fee:
            return "Transportation Fees"
        return obj.fee_head.name if obj.fee_head else 'General'

class ReceiptSerializer(serializers.ModelSerializer):
    transactions = FeeTransactionSerializer(many=True, read_only=True)
    student_name = serializers.ReadOnlyField(source='student.name')
    student_uid = serializers.ReadOnlyField(source='student.student_id')

    class Meta:
        model = Receipt
        fields = ['id', 'receipt_no', 'payment_date', 'student', 'student_name', 'student_uid', 'total_amount', 'remarks', 'transactions']
