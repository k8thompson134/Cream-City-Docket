"""add legistar_web_url to matters

Revision ID: g4h5i6j7k8l9
Revises: f3g4h5i6j7k8
Create Date: 2026-05-18

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'g4h5i6j7k8l9'
down_revision: Union[str, None] = 'f3g4h5i6j7k8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('matters', sa.Column('legistar_web_url', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('matters', 'legistar_web_url')
