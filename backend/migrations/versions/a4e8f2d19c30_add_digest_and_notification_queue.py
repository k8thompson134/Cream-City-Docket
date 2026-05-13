"""add digest mode priority tags and notification queue

Revision ID: a4e8f2d19c30
Revises: 97263e2118bf
Create Date: 2026-05-13 13:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4e8f2d19c30'
down_revision: Union[str, Sequence[str], None] = '97263e2118bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add digest/priority fields to subscribers and create notification_queue."""
    # New columns on subscribers
    op.add_column('subscribers', sa.Column('digest_mode', sa.String(length=20), nullable=False, server_default='daily'))
    op.add_column('subscribers', sa.Column('priority_tags', sa.JSON(), nullable=True))
    op.add_column('subscribers', sa.Column('priority_district', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('subscribers', sa.Column('active', sa.Boolean(), nullable=False, server_default='true'))

    # New column on alert_log
    op.add_column('alert_log', sa.Column('delivery_type', sa.String(length=20), nullable=False, server_default='digest'))

    # Notification queue table
    op.create_table('notification_queue',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subscriber_id', sa.Integer(), nullable=False),
        sa.Column('matter_id', sa.Integer(), nullable=False),
        sa.Column('trigger_event', sa.String(length=100), nullable=False),
        sa.Column('is_priority', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['matter_id'], ['matters.id']),
        sa.ForeignKeyConstraint(['subscriber_id'], ['subscribers.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('subscriber_id', 'matter_id', 'trigger_event'),
    )


def downgrade() -> None:
    """Remove digest/priority fields and notification_queue."""
    op.drop_table('notification_queue')
    op.drop_column('alert_log', 'delivery_type')
    op.drop_column('subscribers', 'active')
    op.drop_column('subscribers', 'priority_district')
    op.drop_column('subscribers', 'priority_tags')
    op.drop_column('subscribers', 'digest_mode')
