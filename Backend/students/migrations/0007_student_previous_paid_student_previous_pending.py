from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0006_student_contact_number'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='previous_pending',
            field=models.DecimalField(decimal_places=2, default=0, help_text='Opening pending balance', max_digits=10),
        ),
        migrations.AddField(
            model_name='student',
            name='previous_paid',
            field=models.DecimalField(decimal_places=2, default=0, help_text='Opening paid balance', max_digits=10),
        ),
    ]
