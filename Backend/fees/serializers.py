from rest_framework import serializers
from .models import FeeHead, FeeStructure, StudentFee, FeeTransaction

class FeeHeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeHead
        fields = '__all__'

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
