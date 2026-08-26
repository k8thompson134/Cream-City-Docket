"""add mayors table

Revision ID: h5i6j7k8l9m0
Revises: g4h5i6j7k8l9
Create Date: 2026-08-26

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'h5i6j7k8l9m0'
down_revision: Union[str, None] = 'g4h5i6j7k8l9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    mayors = op.create_table(
        'mayors',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('title', sa.String(200), nullable=True),
        sa.Column('photo_url', sa.String(500), nullable=True),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('address', sa.String(300), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('hours', sa.String(200), nullable=True),
        sa.Column('twitter', sa.String(100), nullable=True),
        sa.Column('facebook', sa.String(200), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.bulk_insert(mayors, [{
        'name': 'Cavalier Johnson',
        'title': 'Mayor of Milwaukee',
        'photo_url': '/mayor-johnson.jpg',
        'bio': (
            "Mayor Cavalier Johnson took office as Acting Mayor in late 2021 and was elected the "
            "forty-fifth chief executive of the City of Milwaukee in April 2022, winning with more "
            "than seventy percent of the vote. He is the first Black Mayor elected in the city and "
            "only the fourth elected mayor in the past sixty-two years. Before taking on his role "
            "as Acting Mayor, Johnson served as Common Council President while representing the "
            "city's 2nd Aldermanic District. He has prioritized violence reduction, economic "
            "development, and roadway safety."
        ),
        'address': 'City Hall, 200 E. Wells Street, Room 201, Milwaukee, WI 53202',
        'phone': '414-286-2200',
        'hours': 'Monday–Friday, 8:00 AM–4:45 PM',
        'twitter': '@MayorMKE',
        'facebook': 'https://www.facebook.com/MayorofMilwaukee',
        'active': True,
    }])


def downgrade() -> None:
    op.drop_table('mayors')
