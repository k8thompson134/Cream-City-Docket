"""add alder_office_records table and social link fields to alders

Revision ID: d1e2f3g4h5i6
Revises: a1b2c3d4e5f6, a4e8f2d19c30
Create Date: 2026-05-17

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd1e2f3g4h5i6'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f6', 'a4e8f2d19c30')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'alder_office_records',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('alder_id', sa.Integer(), sa.ForeignKey('alders.id'), nullable=False),
        sa.Column('legistar_office_record_id', sa.Integer(), nullable=False),
        sa.Column('legistar_body_id', sa.Integer(), nullable=True),
        sa.Column('body_name', sa.String(300), nullable=True),
        sa.Column('title', sa.String(200), nullable=True),
        sa.Column('start_date', sa.DateTime(), nullable=True),
        sa.Column('end_date', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('alder_id', 'legistar_office_record_id', name='uq_alder_office_record'),
    )
    op.add_column('alders', sa.Column('website', sa.String(500), nullable=True))
    op.add_column('alders', sa.Column('twitter', sa.String(100), nullable=True))
    op.add_column('alders', sa.Column('facebook', sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_table('alder_office_records')
    op.drop_column('alders', 'facebook')
    op.drop_column('alders', 'twitter')
    op.drop_column('alders', 'website')
