"""add ai enrichment fields to alders and matters

Revision ID: f3g4h5i6j7k8
Revises: e2f3g4h5i6j7
Create Date: 2026-05-18

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f3g4h5i6j7k8'
down_revision: Union[str, Sequence[str], None] = 'e2f3g4h5i6j7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('alders', sa.Column('focus_summary', sa.Text(), nullable=True))
    op.add_column('alders', sa.Column('ai_enriched_at', sa.DateTime(), nullable=True))
    op.add_column('matters', sa.Column('substitute_summary', sa.Text(), nullable=True))
    op.add_column('matters', sa.Column('pre_substitute_text_id', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('alders', 'focus_summary')
    op.drop_column('alders', 'ai_enriched_at')
    op.drop_column('matters', 'substitute_summary')
    op.drop_column('matters', 'pre_substitute_text_id')
