from django.db import models

class InventoryItem(models.Model):
    CATEGORY_CHOICES = [
        ('STATIONERY', 'Stationery'),
        ('FURNITURE', 'Furniture'),
        ('ELECTRONICS', 'Electronics'),
        ('OTHER', 'Other'),
    ]

    name = models.CharField(max_length=100)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='OTHER')
    quantity = models.IntegerField(default=0)
    reorder_level = models.IntegerField(default=10, help_text="Alert when stock drops below this")
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.quantity})"

class InventoryTransaction(models.Model):
    TRANSACTION_TYPES = [
        ('IN', 'Stock In'),
        ('OUT', 'Stock Out'),
    ]

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=5, choices=TRANSACTION_TYPES)
    quantity = models.IntegerField()
    transaction_date = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        # Update item quantity on save
        if not self.pk: # Only on creation
            if self.transaction_type == 'IN':
                self.item.quantity += self.quantity
            elif self.transaction_type == 'OUT':
                self.item.quantity -= self.quantity
            self.item.save()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.transaction_type} {self.quantity} - {self.item.name}"
