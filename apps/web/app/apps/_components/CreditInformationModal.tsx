/* By Irfan Akbari Vuteq Indonesia - 2026-09-17 */
import React, { useState } from 'react';
import { Button, Modal } from 'antd';
import { DesktopOutlined, HeartOutlined, InfoCircleOutlined, UserOutlined } from '@ant-design/icons';
import Image from 'next/image';

interface CreditInformationModalProps {
    open: boolean;
    onClose: () => void;
    onOpenUpdateLog: () => void;
    onOpenPrivacyPolicy: () => void;
}

const CreditInformationModal: React.FC<CreditInformationModalProps> = ({
    open,
    onClose,
    onOpenUpdateLog,
    onOpenPrivacyPolicy,
}) => {
    const [technologyStackOpen, setTechnologyStackOpen] = useState(false);

    const projectStartDate = new Date('2026-05-01');
    const today = new Date();
    let totalDevDays = 0;
    const current = new Date(projectStartDate);
    while (current <= today) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            totalDevDays++;
        }
        current.setDate(current.getDate() + 1);
    }

    const itTeam = [
        'Irfan Akbari Habibi',
        'Om Wissa',
        'Om Selpian',
        'Mas Sirojul Kahfi',
    ];

    const operationsTeam = [
        'Pak Anggo',
        'Pak Rizky',
        'Om Andry',
    ];

    return (
        <Modal
            className="ansei-credit-modal"
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                        display: 'inline-flex',
                        padding: 8,
                        borderRadius: 4,
                        color: 'white',
                        background: '#4C6A85',
                    }}>
                        <InfoCircleOutlined />
                    </span>
                    <div>
                        <div style={{ lineHeight: 1.2 }}>Credits & Information</div>
                        <div style={{ marginTop: 2, color: '#64748b', fontSize: 12, fontWeight: 400 }}>
                            The people behind ANSEI
                        </div>
                    </div>
                </div>
            }
            open={open}
            centered={true}
            onCancel={onClose}
            footer={[
                <Button
                    key="update-log"
                    onClick={() => {
                        onClose();
                        onOpenUpdateLog();
                    }}
                >
                    Update Log
                </Button>,
                <Button key="tech-stack" onClick={() => setTechnologyStackOpen(true)}>
                    Tech Stack
                </Button>,
                <Button
                    key="privacy-policy"
                    onClick={() => {
                        onClose();
                        onOpenPrivacyPolicy();
                    }}
                >
                    Privacy Policy
                </Button>,
                <Button key="close" type="primary" onClick={onClose}>
                    Close
                </Button>,
            ]}
            width={820}
        >
            <div className="ansei-credit-content" style={{ padding: '12px 0 4px' }}>
                <div style={{
                    position: 'relative',
                    overflow: 'hidden',
                    textAlign: 'center',
                    marginBottom: 24,
                    padding: '28px 24px',
                    borderRadius: 6,
                    color: 'white',
                    background: '#263545',
                    animation: 'ansei-credit-glow 3s ease-in-out infinite',
                }}>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        width: '35%',
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
                        animation: 'ansei-credit-shimmer 4s ease-in-out infinite',
                    }} />
                    <HeartOutlined style={{
                        position: 'absolute',
                        top: -18,
                        right: 18,
                        fontSize: 92,
                        color: 'rgba(255,255,255,0.12)',
                        animation: 'ansei-credit-float 3.2s ease-in-out infinite',
                    }} />
                    <div style={{
                        position: 'relative',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.14)',
                    }}>
                        <HeartOutlined style={{
                            fontSize: 22,
                            color: '#fecaca',
                            animation: 'ansei-heartbeat 1.6s ease-in-out infinite',
                        }} />
                    </div>
                    <h2 style={{ position: 'relative', margin: '12px 0 0', fontSize: 25, color: 'white' }}>
                        ANSEI - Inventory & Production System
                    </h2>
                    <p style={{ position: 'relative', margin: '8px 0 0', color: 'rgba(255,255,255,0.85)' }}>
                        Crafted through the collaboration of IT and Production Teams
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
                    <div style={{ display: 'grid', gap: 16 }}>
                        <div style={{ padding: '16px 18px', borderRadius: 6, background: '#EDF2F6' }}>
                            <div style={{
                                color: '#4C6A85',
                                fontSize: 12,
                                fontWeight: 700,
                                letterSpacing: 1,
                                textTransform: 'uppercase',
                            }}>
                                Core Developer
                            </div>
                            <div style={{ marginTop: 4, color: '#293241', fontSize: 20, fontWeight: 700 }}>
                                Irfan Akbari Habibi
                            </div>
                            <div style={{ marginTop: 6, color: '#475569', fontStyle: 'italic' }}>
                                “Precision in logic, excellence in execution — crafting digital tools that empower manufacturing every day.”
                            </div>
                        </div>
                        <div style={{ background: '#f5f5f5', borderRadius: 14, padding: 16, textAlign: 'center' }}>
                            <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>Total Development Days</div>
                            <div style={{
                                fontSize: 48,
                                fontWeight: 'bold',
                                color: '#4C6A85',
                                lineHeight: 1,
                            }}>
                                {totalDevDays}
                            </div>
                            <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>Days (May 2026 - Present)</div>
                        </div>
                        <div style={{
                            padding: '14px 16px',
                            borderRadius: 6,
                            background: '#EDF2F6',
                            color: '#293241',
                            fontStyle: 'italic',
                            textAlign: 'center',
                        }}>
                            “Quality is built into the process: zero defects through thoughtful design and continuous kaizen.”
                        </div>
                    </div>
                    <div style={{ display: 'grid', gap: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                                <h4 style={{
                                    margin: '0 0 12px',
                                    paddingBottom: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}>
                                    <DesktopOutlined /> IT Department
                                </h4>
                                <ul style={{ margin: 0, padding: 0, listStyleType: 'none' }}>
                                    {itTeam.map((name) => (
                                        <li
                                            key={name}
                                            style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}
                                        >
                                            <span style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                background: '#4C6A85',
                                            }} />
                                            {name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h4 style={{
                                    margin: '0 0 12px',
                                    paddingBottom: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}>
                                    <UserOutlined /> Production Dept
                                </h4>
                                <ul style={{ margin: 0, padding: 0, listStyleType: 'none' }}>
                                    {operationsTeam.map((name) => (
                                        <li
                                            key={name}
                                            style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}
                                        >
                                            <span style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                background: '#93A8B8',
                                            }} />
                                            {name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div style={{ padding: 16, background: '#304254', borderRadius: 6, color: 'white' }}>
                            <h4 style={{ margin: '0 0 10px', paddingBottom: 8 }}>⭐ Project Advisors</h4>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '8px 12px',
                            }}>
                                {['Nakajima-san', 'Pak Supriadi', 'Pak Abdillah', 'Pak Hermanto'].map((name) => (
                                    <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            background: '#ffd700',
                                        }} />
                                        {name}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div style={{
                            padding: '14px 16px',
                            borderRadius: 12,
                            background: '#fffbeb',
                            color: '#b45309',
                            fontStyle: 'italic',
                            textAlign: 'center',
                        }}>
                            “Code is not just instructions for machines; it is a promise to the people who use it.”
                        </div>
                    </div>
                </div>

                <div style={{
                    marginTop: '24px',
                    paddingTop: '16px',
                    textAlign: 'center',
                    color: '#999',
                    fontSize: '12px',
                }}>
                    Project Started: January 2026 | Developed with{' '}
                    <HeartOutlined style={{ color: '#dc2626', animation: 'ansei-heartbeat 1.6s ease-in-out infinite' }} />{' '}
                    by IT Teams
                </div>
            </div>
            <Modal
                title="Technology Stack"
                open={technologyStackOpen}
                centered
                onCancel={() => setTechnologyStackOpen(false)}
                footer={<Button type="primary" onClick={() => setTechnologyStackOpen(false)}>Close</Button>}
                width={520}
            >
                <div style={{
                    padding: '12px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    border: '1px solid #e2e8f0',
                }}>
                    <div style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                    }}>
                        Security Powered by
                    </div>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center', justifyContent: 'center' }}>
                        <Image
                            src="/images/ssl.png"
                            alt="SSL Secured"
                            width={120}
                            height={30}
                            style={{ objectFit: 'contain' }}
                        />
                        <Image
                            src="/images/aes.webp"
                            alt="AES 256 Encryption"
                            width={60}
                            height={60}
                            style={{ objectFit: 'contain' }}
                        />
                    </div>
                </div>
            </Modal>
        </Modal>
    );
};

export default CreditInformationModal;
