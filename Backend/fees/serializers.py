from rest_framework import serializers
from .models import FeeHead, FeeStructure, StudentFee, FeeTransaction, FeeAmount

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
            'frequency', 'due_day', 'due_months', 
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
    class Meta:
        model = FeeTransaction
        fields = '__all__'
