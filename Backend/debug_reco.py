import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'school_erp.settings')
django.setup()

from fees.models import BankStatementEntry, FeeTransaction

print(f"BankStatementEntry count: {BankStatementEntry.objects.count()}")
print(f"Unreconciled BankStatementEntry: {BankStatementEntry.objects.filter(is_reconciled=False).count()}")
print(f"Online FeeTransaction count: {FeeTransaction.objects.filter(receipt__payment_mode='ONLINE').count()}")
print(f"Unreconciled Online FeeTransaction: {FeeTransaction.objects.filter(receipt__payment_mode='ONLINE', bank_matches__isnull=True).count()}")
